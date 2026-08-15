# Supported Python subset

This is the exact scope contract implemented by `src/subset/`. It mirrors `docs/PLAN_v2.md` §1 —
that document is the source of truth if the two ever disagree.

Every program run in this tool is checked against this list **before** anything executes. A program
using something outside it is rejected with a message naming the construct and the line, never a
raw Python traceback.

## In scope

- **Types:** `int` `float` `str` `bool` `None` `list` `dict`
- **Assignment:** simple, chained (`a = b = 0`), augmented (`+= -= *= /= //= %= **=`), and the
  two-item swap idiom (`a[i], a[i+1] = a[i+1], a[i]`) — see "The swap exception" below
- **Operators:** `+ - * / // % **`, unary minus, `== != < <= > >=`, `and or not`, `in`, `not in`
- **Control flow:** `if` / `elif` / `else` · `for` over `range()`, a list, a string, or a dict (a
  dict iterates its keys — the validator doesn't restrict the iterable's runtime type, only its
  syntax) · `while` · `break` `continue` · `pass`
- **Functions:** `def` with positional parameters, `return`, recursion
- **Lists:** index read/write including negative indices, slice _read_, nested lists, `.append()`
  `.pop()` `.insert()`
- **Dicts:** literal, key read/write
- **Strings:** indexing, concatenation, f-strings
- **Builtins:** `print()` `range()` `len()` `int()` `str()` `float()` `abs()` `min()` `max()` `sum()`

## Out of scope

Each is rejected with the format `"<construct> isn't supported yet — line N. <alternative>"`:

| Construct | Suggested alternative shown to the user |
| --- | --- |
| `class` | This tool focuses on functions and loops, not custom classes. |
| `import` | Everything you need is already available without importing. |
| `try` / `except` | Errors are shown to you automatically when they happen. |
| `with` | This tool doesn't work with files or external resources. |
| `lambda` | Write a regular function with `def` instead. |
| generators / `yield` | Build a list and return it instead. |
| decorators (`@...`) | Write the function body directly. |
| `global` / `nonlocal` | Pass values in and return them instead of sharing across functions. |
| comprehensions | Write it as a `for` loop that builds the list with `.append()`. |
| sets | Use a list or a dict instead. |
| tuples | Use a list instead (except for the two-item swap, which is allowed — see below). |
| `*args` / `**kwargs` | Give the function a fixed list of named parameters. |
| closures (a function defined inside another function) | Define functions at the top level. |
| chained comparisons (`a < b < c`) | Write it as two comparisons joined with `and`. |
| `while` / `else` | Just use a regular `while` loop. |
| keyword arguments (`f(x=1)`) | Pass arguments in order instead. |
| slice assignment (`a[1:3] = ...`) | Assign to one index at a time, or build a new list. |

### The swap exception

Tuples are out of scope, but the normal Python way to swap two list items —
`a[i], a[i+1] = a[i+1], a[i]` — is tuple syntax, and sort lessons need it. The validator recognizes
**exactly** this shape (two targets on the left, two values on the right, values in swapped order) as
a swap and allows it. Everything else that looks like a tuple — literals, 3-way rotations, returning
multiple values, unpacking into more than two names — is still rejected. See
`docs/DESIGN_RATIONALE.md` §21.

## Guardrails

| Guard | Limit | Checked by |
| --- | --- | --- |
| Max source length | 100 lines | the validator (milestone 2) |
| Max list / dict length, as a **literal** in the source | 25 | the validator (milestone 2) |
| Max list / dict length, **grown at runtime** (e.g. via `.append()` in a loop) | 25 | the engine (milestone 3) |
| Max steps per run | 2,000 | the engine (milestone 3) |
| Max wall-clock execution | 3 seconds | the engine (milestone 3) |
| Max recursion depth | 25 | the engine (milestone 3) |

The first two are visible in the source text itself, so the validator can catch them with nothing
running. The rest only happen while code is executing, which requires the Pyodide-based engine —
not built until milestone 3. See `docs/DESIGN_RATIONALE.md` §21.
