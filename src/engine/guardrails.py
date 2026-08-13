"""Runtime guardrails enforced while a user's program executes.

The static guardrails (source length, oversized literals) are already caught by the
validator (src/subset/) before this ever runs. The three left here only exist while code
is *running*: max steps, max recursion depth, and a list/dict that grows past 25 items via
.append()/assignment rather than starting that large. See docs/DESIGN_RATIONALE.md §21/§22
and docs/SUBSET.md for the full guardrail table.

This is deliberately not the trace pipeline (that's milestone 4) — it counts and checks
bounds, it does not capture a recording.
"""

import sys

MAX_STEPS = 2000
MAX_RECURSION_DEPTH = 25
# D8's 25-item cap, runtime case (a list/dict growing past 25 via .append() while running).
# The static case (a literal over 25 in the source) is enforced separately by
# src/subset/parser.ts's own MAX_COLLECTION_SIZE, which must be kept equal to this — there
# is no way to share one literal across the TypeScript/Python boundary, so this comment is
# the cross-reference instead of a build-time link.
MAX_COLLECTION_SIZE = 25

# The exact filename user code is compiled under (see worker.ts). Used to tell the user's
# own frames apart from Pyodide's internal bridging frames, so neither the step count nor
# the recursion depth is inflated by execution machinery the user never wrote.
USER_CODE_FILENAME = "<user_code>"


class GuardrailExceeded(Exception):
    """Raised from inside the trace function the moment a limit is crossed. `guardrail`
    identifies which one, for callers that want to react differently per guardrail."""

    def __init__(self, guardrail, message):
        super().__init__(message)
        self.guardrail = guardrail


def _collection_too_large(value, seen):
    """Recurses into lists/dicts (matching how a nested grid is a list of lists, each
    checked independently — see D8) looking for anything over MAX_COLLECTION_SIZE. `seen`
    guards against a structure that references itself."""
    obj_id = id(value)
    if obj_id in seen:
        return False

    if isinstance(value, list):
        seen.add(obj_id)
        if len(value) > MAX_COLLECTION_SIZE:
            return True
        return any(_collection_too_large(item, seen) for item in value)

    if isinstance(value, dict):
        seen.add(obj_id)
        if len(value) > MAX_COLLECTION_SIZE:
            return True
        return any(_collection_too_large(item, seen) for item in value.values())

    return False


def _check_step(state):
    """Shared by guard() below and tracer.py's own settrace hook, so the two guardrail
    paths (m3's pass/fail execute_guarded and m4's recording record_trace) can never
    silently drift apart — a future change to the threshold or message only has one place
    to happen. `state` is the caller's own {"steps": int, "depth": int} dict."""
    state["steps"] += 1
    if state["steps"] > MAX_STEPS:
        raise GuardrailExceeded(
            "max_steps",
            f"this program ran more than {MAX_STEPS} steps — "
            "there may be a loop that never ends.",
        )


def _check_recursion_depth(state):
    state["depth"] += 1
    if state["depth"] > MAX_RECURSION_DEPTH:
        raise GuardrailExceeded(
            "recursion_depth",
            f"this recurses more than {MAX_RECURSION_DEPTH} levels deep — "
            "check that the base case is actually reachable.",
        )


def _check_collection_size(frame_locals):
    # Deliberately not optimized to skip locals that didn't change since the last line: at
    # this project's caps (<=2,000 steps, <=25 items per collection, <=100-line source) the
    # extra walk costs microseconds, well inside the 3-second budget, and diffing "did this
    # local change" would need the same kind of before/after value tracking the tracer
    # already does — not worth duplicating here for a cost this small.
    for name, value in frame_locals.items():
        # Dunder names (__builtins__ and friends) are exec()'s own machinery, not user
        # data, and would otherwise false-trip this check immediately.
        if name.startswith("__"):
            continue
        if _collection_too_large(value, set()):
            raise GuardrailExceeded(
                "collection_size",
                f"a list or dict grew past {MAX_COLLECTION_SIZE} items while "
                "running — this visualizer keeps everything to 25 items or fewer.",
            )


def make_guard():
    """Returns a fresh sys.settrace-compatible function with its own counters, so state
    never leaks between separate executions in the same worker."""
    state = {"steps": 0, "depth": 0}

    def guard(frame, event, arg):
        is_user_frame = frame.f_code.co_filename == USER_CODE_FILENAME
        # The very first "call" event is exec()'s own module-level frame, not a function
        # the user called — excluded so depth counts actual function calls only, matching
        # "recursion to depth 10 produces exactly 10 stack frames" (§3 AC-5).
        is_user_function_call = is_user_frame and frame.f_code.co_name != "<module>"

        if event == "call":
            if is_user_function_call:
                _check_recursion_depth(state)
            return guard

        if event == "line" and is_user_frame:
            _check_step(state)
            _check_collection_size(frame.f_locals)

        if event == "return" and is_user_function_call:
            state["depth"] -= 1

        return guard

    return guard


def execute_guarded(source):
    """The one function worker.ts calls. Compiles and runs `source` under the guardrail
    trace function, and returns a JSON string (never a Python object) describing exactly
    what happened — this is what actually satisfies AC-2.6, since a JSON string is plain
    data by construction, with no PyProxy possible even by accident.

    Every branch below is a *result*, not a re-raise: nothing escapes this function as a
    live Python exception, because the JS side must never need to know Python-exception
    shapes to do its job.
    """
    import contextlib
    import io
    import json

    output_buffer = io.StringIO()

    try:
        code = compile(source, USER_CODE_FILENAME, "exec")
    except SyntaxError as exc:
        # The m2 validator accepted this program; real Python didn't. That's a gap in the
        # validator's grammar coverage surfacing for real — not an ordinary program bug —
        # so it gets its own status rather than being folded into runtime_error.
        return json.dumps(
            {
                "status": "validator_mismatch",
                "message": f"{type(exc).__name__}: {exc}",
            }
        )

    guard = make_guard()
    sys.settrace(guard)
    try:
        with contextlib.redirect_stdout(output_buffer):
            exec(code, {})
    except GuardrailExceeded as exc:
        return json.dumps({"status": "guardrail", "guardrail": exc.guardrail, "message": str(exc)})
    except Exception as exc:  # noqa: BLE001 - deliberately broad: any user-program error becomes a result
        return json.dumps(
            {
                "status": "runtime_error",
                "errorType": type(exc).__name__,
                "message": str(exc),
                "stdout": output_buffer.getvalue(),
            }
        )
    except BaseException as exc:  # noqa: BLE001 - SystemExit/KeyboardInterrupt/GeneratorExit
        # `except Exception` above does NOT catch these — they're BaseException but not
        # Exception subclasses. The subset validator doesn't whitelist callable names, so a
        # bare exit()/quit() call (present in CPython's builtins via the site module) would
        # otherwise escape this function entirely, breaking the "every branch is a result,
        # nothing re-raises" guarantee this docstring promises.
        return json.dumps(
            {
                "status": "runtime_error",
                "errorType": type(exc).__name__,
                "message": str(exc),
                "stdout": output_buffer.getvalue(),
            }
        )
    finally:
        sys.settrace(None)

    return json.dumps({"status": "ok", "stdout": output_buffer.getvalue()})
