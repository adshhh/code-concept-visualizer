"""The Tier 2 ("Detailed") trace pipeline: milestone 11a (§3 T2, D4/D38). Same Frame[]
contract as tracer.py's `record_trace`, plus a `event` field on frames produced by an
injected sub-expression report — the difference between watching a line finish and watching
it unfold. See docs/PLAN_v2.md §3's Tier 2 acceptance criteria and
docs/DESIGN_RATIONALE.md's entry on this milestone for the technique and the near-misses a
prototyping pass found before this file was written.

Depends on names from guardrails.py (GuardrailExceeded, _check_step, USER_CODE_FILENAME) and
tracer.py (_snapshot, _json_safe_copy, make_tracer) exactly like tracer.py depends on
guardrails.py — worker.ts loads guardrails.py, then tracer.py, then this file into the same
Pyodide instance, in that order, so those names are already globals by the time this runs.

**The core technique (DESIGN_RATIONALE.md's own description):** parse the user's code, rewrite
it to wrap every read, index, comparison, and append in a small reporting function that
performs the real operation and returns the result unchanged, then run the *rewritten* tree
under the exact same settrace mechanism tracer.py already proved. `call`/`return` need no
rewrite at all — `sys.settrace` already hands a 'return' event's return value as `arg`;
tracer.py's own hook just never reads it (see `_DetailedTracer` below).

**Every rewrite follows one rule, load-bearing enough to repeat here:** the reporter receives
already-evaluated operands and performs the operation itself — never a pre-computed result
alongside the expression that produced it. A rewrite shaped
`__report(expr, expr_result)` evaluates `expr` twice; `__report(expr)` (reporter computes the
result) evaluates it once. The one shape that can't be a single wrapping call — an assignment
to a subscript, `nums[i] = v` — instead becomes a short statement sequence using generated
temporaries, so the index and value are each still evaluated exactly once. The subset's one
tuple exception (the two-target swap idiom bubble/insertion sort depend on) is the sharpest
version of this: a naive per-target rewrite reads each side *after* the other has already
been overwritten and silently produces the wrong answer. See `_rewrite_assign_targets` and
`docs/DESIGN_RATIONALE.md`.
"""

import ast
import sys

# Reporters live in exec()'s globals dict under these names. The leading "__ccv_" prefix
# (not just "__") is deliberate: _capture_variables already skips any dunder-prefixed name,
# so a bare "__report" would already be invisible to variable snapshots — the longer prefix
# is extra insurance against a user variable name ever colliding with one of these.
_REPORT_COMPARE = "__ccv_report_compare"
_REPORT_INDEX_READ = "__ccv_report_index_read"
_REPORT_INDEX_WRITE = "__ccv_report_index_write"
_REPORT_APPEND = "__ccv_report_append"

# Only the six comparison operators §5's "compare" gesture actually draws (two boxes,
# lift-and-resolve) — `in`/`not in` are also ast.Compare operators under the subset's grammar
# but are a membership test on a container, not a two-value comparison, so they're
# deliberately left uninstrumented (the transformer leaves that Compare node untouched,
# `op_str is None` below) rather than forced into a gesture that doesn't fit them.
_COMPARE_OPS = {
    ast.Eq: ("==", lambda a, b: a == b),
    ast.NotEq: ("!=", lambda a, b: a != b),
    ast.Lt: ("<", lambda a, b: a < b),
    ast.LtE: ("<=", lambda a, b: a <= b),
    ast.Gt: (">", lambda a, b: a > b),
    ast.GtE: (">=", lambda a, b: a >= b),
}
_COMPARE_FUNCS = {op_str: fn for op_str, fn in _COMPARE_OPS.values()}


def _copy_loc(new_node, anchor):
    """`ast.copy_location` alone, not `ast.fix_missing_locations` alone — a prototyping pass
    found the latter fills a missing location from the *parent*, which is wrong the moment a
    constructed node's real position differs from its statement's first line (a multi-line
    expression). Every node this module constructs goes through this. `fix_missing_locations`
    is still called once, globally, at the end — a backstop for the handful of location-less
    fields (like `Store()`/`Load()` context objects) `copy_location` doesn't touch, not a
    substitute for calling this everywhere."""
    return ast.copy_location(new_node, anchor)


def _load(name):
    return ast.Name(id=name, ctx=ast.Load())


def _const(value):
    return ast.Constant(value=value)


def _call(func_name, args, anchor):
    node = ast.Call(func=_load(func_name), args=args, keywords=[])
    return _copy_loc(node, anchor)


def _assign(anchor, target_name, value_node):
    node = ast.Assign(targets=[ast.Name(id=target_name, ctx=ast.Store())], value=value_node)
    return _copy_loc(node, anchor)


class _DetailedTransformer(ast.NodeTransformer):
    """Rewrites an already-`validate()`-accepted tree. Only ever instruments shapes the
    subset's own grammar guarantees are simple (a bare-NAME container, a single-operator
    comparison) — anything else is left untouched, the same "fails closed" policy
    `indexVars.ts`/`errorMessages.ts` use on the player side. `generic_visit` always runs
    first in every method below, so nested rewrites compose inner-first (a subscript inside a
    comparison gets wrapped before the comparison wraps around it)."""

    def visit_Compare(self, node):
        self.generic_visit(node)
        if len(node.ops) != 1:
            return node  # chained comparisons are already out of scope (the subset rejects
            # them before this ever runs) — fails closed anyway rather than assuming.
        op_str = _COMPARE_OPS.get(type(node.ops[0]), (None, None))[0]
        if op_str is None:
            return node  # `in`/`not in` — not one of §3's five events, left alone.
        return _call(
            _REPORT_COMPARE,
            [node.left, _const(op_str), node.comparators[0]],
            node,
        )

    def visit_Subscript(self, node):
        self.generic_visit(node)
        if not isinstance(node.ctx, ast.Load):
            return node  # Store-context subscripts are handled by visit_Assign below —
            # touching them here would instrument an assignment *target* as if it were a read.
        if not isinstance(node.value, ast.Name):
            return node  # fails closed: only nums[i], never a chained/nested container.
        if isinstance(node.slice, ast.Slice):
            return node  # fails closed: a slice read (nums[1:3], AC-1's own "slice read" —
            # SUBSET.md) is not a single index_read — its value is a Python `slice` object,
            # not JSON-serializable, and §3's five events don't include one for it anyway.
            # Found only by running the full equivalence suite against every accepted
            # fixture: 14_list_slice_read.py crashed record_detailed_trace outright before
            # this guard existed, exactly the class of gap that test was written to catch.
        return _call(
            _REPORT_INDEX_READ,
            [node.value, node.slice, _const(node.value.id)],
            node,
        )

    def visit_Call(self, node):
        self.generic_visit(node)
        func = node.func
        is_append = (
            isinstance(func, ast.Attribute)
            and func.attr == "append"
            and isinstance(func.value, ast.Name)
            and len(node.args) == 1
            and not node.keywords
        )
        if not is_append:
            return node
        return _call(
            _REPORT_APPEND,
            [func.value, node.args[0], _const(func.value.id)],
            node,
        )

    def visit_Assign(self, node):
        self.generic_visit(node)
        rewritten = _rewrite_assign_targets(node)
        return rewritten if rewritten is not None else node


def _rewrite_assign_targets(node):
    """Handles exactly two shapes, both already run through `generic_visit` by the caller so
    the value side's own reads/compares are already instrumented: a single subscript target
    (`nums[i] = v`) and the subset's one tuple exception, a two-target swap
    (`nums[j], nums[j+1] = nums[j+1], nums[j]` — SUBSET.md). Chained assignment
    (`len(node.targets) > 1`) and any other target shape are left completely untouched —
    the validator only ever produces these two shapes for a subscript target, so nothing is
    silently under-instrumented, only intentionally out of this milestone's scope (e.g. a
    nested `grid[i][j] = v` write, matching indexVars.ts's own one-level-deep limit).

    **Why per-target temporaries, not a single wrapping call (the finding a prototyping pass
    caught):** an assignment target isn't a sub-expression a reporter can wrap and return —
    it's a place to store into. And for the swap shape specifically, real Python evaluates the
    *entire* right-hand side before storing into *any* target (measured directly: `a[i], a[j]
    = a[j], a[i]` reads both original values before either is overwritten) — rewriting each
    target as an independent sequential statement breaks that and silently swaps in the
    already-overwritten value instead of the original one. This function evaluates every value
    expression into its own temporary first, in source order, exactly mirroring that, then
    stores into each target in turn using a second temporary for its index (evaluated once,
    right before its own store — matching real Python's own per-target evaluation, confirmed
    by measurement) — before reporting what was written.
    """
    target = node.targets[0] if len(node.targets) == 1 else None
    if target is None:
        return None

    if isinstance(target, ast.Subscript):
        targets = [target]
        values = [node.value]
    elif isinstance(target, ast.Tuple):
        elts = target.elts
        if (
            len(elts) != 2
            or not isinstance(node.value, ast.Tuple)
            or len(node.value.elts) != 2
        ):
            return None  # the validator's own swap check guarantees this shape when it's a
            # 2-subscript tuple target — anything else here means this isn't actually that
            # shape, so leave it alone rather than assume.
        targets = list(elts)
        values = list(node.value.elts)
    else:
        return None

    stmts = []
    value_names = []
    for i, value_node in enumerate(values):
        name = f"__ccv_val{i}"
        stmts.append(_assign(node, name, value_node))
        value_names.append(name)

    any_subscript = False
    for i, one_target in enumerate(targets):
        value_ref = _load(value_names[i])
        if isinstance(one_target, ast.Subscript) and isinstance(one_target.value, ast.Name):
            any_subscript = True
            container_name = one_target.value.id
            idx_name = f"__ccv_idx{i}"
            stmts.append(_assign(node, idx_name, one_target.slice))
            store = ast.Assign(
                targets=[
                    ast.Subscript(
                        value=_load(container_name),
                        slice=_load(idx_name),
                        ctx=ast.Store(),
                    )
                ],
                value=value_ref,
            )
            stmts.append(_copy_loc(store, node))
            stmts.append(
                ast.Expr(
                    value=_call(
                        _REPORT_INDEX_WRITE,
                        [
                            _load(container_name),
                            _load(idx_name),
                            _load(value_names[i]),
                            _const(container_name),
                        ],
                        node,
                    )
                )
            )
            stmts[-1] = _copy_loc(stmts[-1], node)
        else:
            simple = ast.Assign(targets=[one_target], value=value_ref)
            stmts.append(_copy_loc(simple, node))

    if not any_subscript:
        return None  # a plain scalar swap (or single plain-name assignment shape that
        # somehow reached here) — nothing to instrument, let the original node stand so
        # nothing is rewritten without reason.
    return stmts


def _make_reporters(frames, state, source_lines, output_buffer):
    """Returns the four reporter functions injected into exec()'s globals. Each performs its
    real operation, counts one step against the *same* budget make_tracer's line events use
    (`state` is shared — see tracer.py's own `make_tracer` docstring), builds a Frame via
    `_snapshot` exactly like a line event does, and returns the value unchanged so the
    rewritten expression computes the same result the original did."""

    def _emit(user_frame, event):
        variables, call_stack = _snapshot(user_frame)  # noqa: F821 - from tracer.py
        line_no = user_frame.f_lineno
        code_text = (
            source_lines[line_no - 1].strip()
            if 0 < line_no <= len(source_lines)
            else ""
        )
        _check_step(state)  # noqa: F821 - from guardrails.py
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
                "event": event,
            }
        )

    def report_compare(left, op, right):
        result = _COMPARE_FUNCS[op](left, right)
        _emit(
            sys._getframe(1),
            {
                "kind": "compare",
                "left": _json_safe_copy(left),  # noqa: F821 - from tracer.py
                "op": op,
                "right": _json_safe_copy(right),  # noqa: F821
                "result": result,
            },
        )
        return result

    def report_index_read(container, index, name):
        value = container[index]
        _emit(
            sys._getframe(1),
            {
                "kind": "index_read",
                "container": name,
                "index": index,
                "value": _json_safe_copy(value),  # noqa: F821
            },
        )
        return value

    def report_index_write(container, index, value, name):
        # The actual store already happened in the statement just before this call (see
        # _rewrite_assign_targets) — this reporter only ever records it, never performs it,
        # since "target" isn't a sub-expression with a value a wrapping call could return.
        _ = container
        _emit(
            sys._getframe(1),
            {
                "kind": "index_write",
                "container": name,
                "index": index,
                "value": _json_safe_copy(value),  # noqa: F821
            },
        )
        return None

    def report_append(container, value, name):
        container.append(value)
        _emit(
            sys._getframe(1),
            {
                "kind": "append",
                "container": name,
                "index": len(container) - 1,
                "value": _json_safe_copy(value),  # noqa: F821
            },
        )
        # list.append() itself always returns None — matching that exactly (not the appended
        # value) is what keeps "the rewritten program computes exactly what the original did"
        # true even for the rare case of something depending on append's own return value.
        return None

    return {
        _REPORT_COMPARE: report_compare,
        _REPORT_INDEX_READ: report_index_read,
        _REPORT_INDEX_WRITE: report_index_write,
        _REPORT_APPEND: report_append,
    }


def _make_detailed_tracer(base_tracer, frames, state, output_buffer, source_lines):
    """Wraps tracer.py's own `make_tracer` output rather than reimplementing line/call
    handling — adds exactly one new thing: capturing a function's actual return value.
    `sys.settrace`'s 'return' event already hands that value as `arg`; tracer.py's own hook
    just never reads it (finding, not a gap in tracer.py — nothing needed it before this
    milestone). Runs `base_tracer` first (so its own pending-line flush for the returning
    call's last line, if any, is already appended), then adds the return-value frame after —
    "here's what the last line left behind, and here's the value flowing back to the caller."

    **Must always return itself, never whatever `base_tracer` returns — found only by running
    this, not by reading it.** `sys.settrace`'s local-trace-function protocol calls whatever a
    frame's 'call' event *returned* for every later event in that same frame, bypassing the
    global trace function entirely from then on. `base_tracer` returns its own inner function
    (the standard "keep tracing" idiom, correct for tracer.py taken alone) — returning *that*
    from here means Python silently swaps this wrapper out after the very first event in every
    frame, so no 'return' event ever reaches it again. Measured directly: with this wrapper
    returning `base_tracer`'s result, a traced `def f(n): return n+1` produced a 'call' event
    and nothing else — no 'line', no 'return' — for that frame, ever.
    """

    def tracer(frame, event, arg):
        base_tracer(frame, event, arg)
        is_user_function_return = (
            event == "return"
            and frame.f_code.co_filename == USER_CODE_FILENAME  # noqa: F821
            and frame.f_code.co_name != "<module>"
        )
        if is_user_function_return:
            variables, call_stack = _snapshot(frame)  # noqa: F821
            line_no = frame.f_lineno
            code_text = (
                source_lines[line_no - 1].strip()
                if 0 < line_no <= len(source_lines)
                else ""
            )
            _check_step(state)  # noqa: F821
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
                    "event": {
                        "kind": "return",
                        "name": frame.f_code.co_name,
                        "value": _json_safe_copy(arg),  # noqa: F821
                    },
                }
            )
        return tracer

    return tracer


def record_detailed_trace(source, input=None):
    """Tier 2's one entry point — same result-shape contract as tracer.py's `record_trace`
    (every branch a JSON string, `source`+`frames` on every outcome that ran at all), so
    everything downstream of a RunResult (§8's error UX, the player, the committed-snapshot
    mechanism) needs no branching on which tier produced it. `input` is accepted and unused
    for the same reason `record_trace`'s is (see its own docstring) — kept for signature
    symmetry, not a new open question.
    """
    import contextlib
    import io
    import json

    _ = input

    output_buffer = io.StringIO()

    try:
        tree = ast.parse(source, filename=USER_CODE_FILENAME)  # noqa: F821
    except SyntaxError as exc:
        return json.dumps(
            {
                "status": "validator_mismatch",
                "message": f"{type(exc).__name__}: {exc}",
            }
        )

    tree = _DetailedTransformer().visit(tree)
    ast.fix_missing_locations(tree)

    try:
        code = compile(tree, USER_CODE_FILENAME, "exec")  # noqa: F821
    except SyntaxError as exc:
        # A rewrite bug producing invalid syntax surfaces here rather than crashing this
        # call outright — same "every branch is a result" contract as everything else in
        # this pipeline, even for a failure mode that would mean a bug in this module itself.
        return json.dumps(
            {
                "status": "validator_mismatch",
                "message": f"{type(exc).__name__}: {exc}",
            }
        )

    source_lines = source.splitlines()
    frames = []
    state = {"steps": 0, "depth": 0}
    base_tracer = make_tracer(  # noqa: F821 - from tracer.py
        source_lines, output_buffer, frames, state=state
    )
    tracer = _make_detailed_tracer(base_tracer, frames, state, output_buffer, source_lines)
    reporters = _make_reporters(frames, state, source_lines, output_buffer)

    sys.settrace(tracer)
    try:
        with contextlib.redirect_stdout(output_buffer):
            exec(code, dict(reporters))
    except GuardrailExceeded as exc:  # noqa: F821 - from guardrails.py
        return json.dumps(
            {
                "status": "guardrail",
                "guardrail": exc.guardrail,
                "message": str(exc),
                "source": source,
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
                "source": source,
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
                "source": source,
                "frames": frames,
            }
        )
    finally:
        sys.settrace(None)

    return json.dumps(
        {
            "status": "ok",
            "stdout": output_buffer.getvalue(),
            "source": source,
            "frames": frames,
        }
    )
