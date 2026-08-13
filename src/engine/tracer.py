"""The Tier 1 trace pipeline: turns a run into a Frame[] recording (§3), not just a
pass/fail result. Deliberately depends on names defined by guardrails.py (GuardrailExceeded,
_check_step, _check_recursion_depth, _check_collection_size, USER_CODE_FILENAME) rather than
redefining them — worker.ts loads guardrails.py into this same Pyodide instance first, so
those names are already globals by the time this file runs. This is what keeps m3's
pass/fail path (execute_guarded) and m4's recording path (record_trace) enforcing the exact
same limits: one settrace hook enforces the guardrails *and* captures frames in a single
pass, calling guardrails.py's own check functions rather than a second, hand-copied version
of them.

This is Tier 1 only: line events plus deep-copied variable snapshots. No AST rewrite, no
sub-expression events (compare/index_read/...) — that's Tier 2, milestone 11 (D4).
"""

import sys

# JSON numbers decode to a JS double on the other side of the worker boundary (JS has no
# separate integer type), so a Python int beyond this magnitude round-trips through
# JSON.parse silently rounded to a different value. Represented as a string instead — see
# _json_safe_copy.
_MAX_SAFE_INTEGER = 2**53 - 1


def _json_safe_copy(value):
    """Recursively copies `value` the way `copy.deepcopy` would for list/dict (fresh
    containers every time, so no two frames ever share a mutable reference — the bug AC-3.3
    exists to pin) while also guaranteeing the result survives a JSON.stringify round-trip
    on the JS side unchanged. Two real cross-language gaps, both silent otherwise: (1)
    Python's json module emits the bare tokens Infinity/-Infinity/NaN for those float values
    by default — not valid JSON, so JS's JSON.parse throws and the whole run() call rejects
    instead of resolving to a RunResult; (2) Python ints are arbitrary-precision but a JSON
    number decodes into a JS double, silently losing precision past 2**53. Both are
    represented as strings instead, which costs nothing to a future renderer (§5 only ever
    *displays* a captured value, never does further arithmetic on it)."""
    if isinstance(value, bool) or value is None or isinstance(value, str):
        return value
    if isinstance(value, float):
        if value != value:  # NaN is the only value that isn't equal to itself
            return "NaN"
        if value in (float("inf"), float("-inf")):
            return "Infinity" if value > 0 else "-Infinity"
        return value
    if isinstance(value, int):
        return value if abs(value) <= _MAX_SAFE_INTEGER else str(value)
    if isinstance(value, list):
        return [_json_safe_copy(item) for item in value]
    if isinstance(value, dict):
        return {key: _json_safe_copy(item) for key, item in value.items()}
    return value


def _capture_variables(frame_locals):
    """Copies every plain-data local into a JSON-safe snapshot, skipping dunders (exec()'s
    own machinery) and callables (user-defined functions living in module locals aren't a
    *value* to visualize — §5 renders them as call-stack cards, not chips, when actually
    called)."""
    result = {}
    for name, value in frame_locals.items():
        if name.startswith("__"):
            continue
        if callable(value):
            continue
        result[name] = _json_safe_copy(value)
    return result


def _snapshot(frame):
    """Walks from the currently executing frame up through its callers, filtered to this
    program's own frames (by USER_CODE_FILENAME) — Pyodide's own bridging frames stop the
    walk implicitly, since they never match. Splits what it finds into two views mirroring
    how §5 draws them: `module_locals` (top-level chips) and `call_stack` (stacked cards,
    outermost call first, current/innermost call last — each entry its own {name, args,
    locals})."""
    call_stack = []
    module_locals = {}
    f = frame
    while f is not None:
        if f.f_code.co_filename != USER_CODE_FILENAME:  # noqa: F821 - from guardrails.py
            f = f.f_back
            continue
        if f.f_code.co_name == "<module>":
            module_locals = _capture_variables(f.f_locals)
            break
        arg_names = f.f_code.co_varnames[: f.f_code.co_argcount]
        call_stack.append(
            {
                "name": f.f_code.co_name,
                "args": [_json_safe_copy(f.f_locals.get(n)) for n in arg_names],
                "locals": _capture_variables(f.f_locals),
            }
        )
        f = f.f_back
    call_stack.reverse()
    return module_locals, call_stack


def make_tracer(source_lines, output_buffer, frames):
    """Returns a fresh settrace-compatible function with its own counters (never shared
    across calls, same reasoning as guardrails.py's make_guard). `frames` is the caller's
    own list, appended to in place — so whatever was captured before a guardrail trip or a
    runtime error is still sitting in it when record_trace reads it back, satisfying
    "playback needs frames up to the failing step" even on a non-ok result.

    **Why frame capture is deferred by one event, not immediate.** `sys.settrace`'s 'line'
    event fires *before* that line runs — capturing state right there would show line N's
    frame with line N's own effects missing (its assignment hasn't happened yet), which is
    backwards from "step N = what the picture looks like after step N ran" (§3, §7). So
    each frame (keyed by `id(frame)`, since recursive calls get their own distinct frame
    objects) remembers only the *previous* line it saw; the actual Frame is built and
    appended once that line is confirmed complete — signalled by the same frame's next
    'line' event, its 'return', or an 'exception' unwinding through it. This also gives
    AC-3.6 (stdout per frame) the right cutoff for free: a print on line N is already in
    the buffer by the time line N's own frame is emitted.
    """
    state = {"steps": 0, "depth": 0}
    pending = {}  # id(frame) -> line_no, for a line not yet confirmed complete

    def _emit(frame, line_no):
        # "step" is the frame's position in `frames` itself, not the value `state["steps"]`
        # held when the line *started* — those can disagree, because a line that starts
        # (and increments state["steps"]) may not finish (and get appended) until after a
        # nested call's own lines have started and finished first. Using the append
        # position instead guarantees "step" is always monotonic with array order, which is
        # the property playback actually needs (frames[N] is literally "step N").
        variables, call_stack = _snapshot(frame)
        code_text = (
            source_lines[line_no - 1].strip()
            if 0 < line_no <= len(source_lines)
            else ""
        )
        frames.append(
            {
                "step": len(frames) + 1,
                "line": line_no,
                "variables": variables,
                "callStack": call_stack,
                "stdout": output_buffer.getvalue(),
                "narration": (
                    f"line {line_no}: {code_text}" if code_text else f"line {line_no}"
                ),
            }
        )

    def tracer(frame, event, arg):
        is_user_frame = frame.f_code.co_filename == USER_CODE_FILENAME  # noqa: F821
        is_user_function_call = is_user_frame and frame.f_code.co_name != "<module>"
        fid = id(frame)

        if event == "call":
            if is_user_function_call:
                _check_recursion_depth(state)  # noqa: F821 - from guardrails.py
            return tracer

        if event == "line" and is_user_frame:
            if fid in pending:
                _emit(frame, pending.pop(fid))

            # Both shared with guardrails.py's guard() (execute_guarded's own hook) rather
            # than reimplemented here, so m3's pass/fail path and m4's recording path can
            # never silently enforce different limits for the same program.
            _check_step(state)  # noqa: F821
            _check_collection_size(frame.f_locals)  # noqa: F821

            pending[fid] = frame.f_lineno
            return tracer

        if event == "return":
            if fid in pending:
                _emit(frame, pending.pop(fid))
            if is_user_function_call:
                state["depth"] -= 1
            return tracer

        if event == "exception" and is_user_frame:
            # Only reachable for an exception raised by the user's own bytecode (e.g.
            # ZeroDivisionError) — one raised from inside this tracer itself (the
            # GuardrailExceeded calls above) disables tracing immediately per Python's own
            # settrace semantics, so no further trace events fire at all. That's fine: it
            # just means a guardrail trip doesn't get its own cutoff frame, only whatever
            # was already flushed before the trip — still satisfies "partial frames survive
            # a trip," just not down to the exact interrupted line.
            if fid in pending:
                _emit(frame, pending.pop(fid))
            return tracer

        return tracer

    return tracer


def record_trace(source, input=None):
    """The module's one entry point, mirroring execute_guarded's result shape (always a
    JSON string, every branch a result — nothing escapes as a live exception) but with a
    `frames` field on every outcome that ran at all.

    `input` is accepted but deliberately unused — no lesson exists yet to supply
    lesson-specific data (Mode B is m8-9), and how it should actually reach the running
    program (stdin vs. a pre-set variable) is an open question for whenever a real lesson
    first needs it. Threading the parameter through now avoids a signature change later.
    """
    import contextlib
    import io
    import json

    _ = input  # deliberately unused for now — see docstring

    output_buffer = io.StringIO()

    try:
        code = compile(source, USER_CODE_FILENAME, "exec")  # noqa: F821
    except SyntaxError as exc:
        return json.dumps(
            {
                "status": "validator_mismatch",
                "message": f"{type(exc).__name__}: {exc}",
            }
        )

    source_lines = source.splitlines()
    frames = []
    tracer = make_tracer(source_lines, output_buffer, frames)
    sys.settrace(tracer)
    try:
        with contextlib.redirect_stdout(output_buffer):
            exec(code, {})
    except GuardrailExceeded as exc:  # noqa: F821
        return json.dumps(
            {
                "status": "guardrail",
                "guardrail": exc.guardrail,
                "message": str(exc),
                "frames": frames,
            }
        )
    except Exception as exc:  # noqa: BLE001 - any user-program error becomes a result
        return json.dumps(
            {
                "status": "runtime_error",
                "errorType": type(exc).__name__,
                "message": str(exc),
                "stdout": output_buffer.getvalue(),
                "frames": frames,
            }
        )
    except BaseException as exc:  # noqa: BLE001 - SystemExit/KeyboardInterrupt/GeneratorExit
        return json.dumps(
            {
                "status": "runtime_error",
                "errorType": type(exc).__name__,
                "message": str(exc),
                "stdout": output_buffer.getvalue(),
                "frames": frames,
            }
        )
    finally:
        sys.settrace(None)

    return json.dumps({"status": "ok", "stdout": output_buffer.getvalue(), "frames": frames})
