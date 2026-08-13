# Code Concept Visualizer

Write Python, watch it run — step by step, as an animation you control.

Beginners learn control structures by reading static code, which never builds intuition for what
happens at runtime. This tool takes Python **you** write, executes it in the browser with real
CPython (Pyodide, compiled to WebAssembly), and turns the execution into a step-controllable,
gamified animation — without anyone having hand-scripted an animation for that specific example.

> **Status: milestone 3 of 15 — the execution engine (Pyodide, Web Worker, guardrails) is live.**
> The visible app starts at milestone 5. Progress and the full spec are in
> [`docs/PLAN_v2.md`](docs/PLAN_v2.md).

## Running it locally

```bash
npm install
npm run dev
```

| Command              | Does                             |
| -------------------- | -------------------------------- |
| `npm run dev`        | dev server with hot reload       |
| `npm test`           | test suite, single run           |
| `npm run test:watch` | test suite, watching             |
| `npm run typecheck`  | TypeScript, no emit              |
| `npm run format`     | Prettier, writes in place        |
| `npm run build`      | typecheck, then production build |

## How this repository is organised

| Path                                                     | What                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`docs/PLAN_v2.md`](docs/PLAN_v2.md)                     | **the living spec** — 14 sections, 15 build milestones, every acceptance criterion |
| [`docs/PLAN.md`](docs/PLAN.md)                           | the frozen original plan, kept for comparison                                      |
| [`docs/DESIGN_RATIONALE.md`](docs/DESIGN_RATIONALE.md)   | why the design is what it is, written for a human                                  |
| [`docs/decisions/`](docs/decisions/)                     | formal records for decisions that reopened a locked section                        |
| [`docs/checkpoint_report.md`](docs/checkpoint_report.md) | a running log of every milestone                                                   |
| `src/engine/`                                            | runs Python, produces recordings — see its README for the one rule                 |
| `src/player/`                                            | turns a recording into a picture, with no Python present                           |

## Engine start-up time (AC-2.3)

Pyodide loads lazily, inside a Web Worker, the first time code is actually run — not at page
load. Cold (empty cache) and warm (cached) numbers can only be measured in a real browser, not
from this agent's environment (see `docs/DESIGN_RATIONALE.md` for why testing this milestone
splits between Node and a real browser this way). To measure: open the dev server, open devtools,
click Run in the temporary engine harness on the page, and read the `[engine] Pyodide loaded in
…ms` line the worker logs — once with a hard-refreshed/cleared cache (cold), once on a normal
reload (warm).

|            | Target   | Measured                                      |
| ---------- | -------- | --------------------------------------------- |
| Cold start | —        | _owner to fill in after a real-browser check_ |
| Warm start | under 1s | _owner to fill in after a real-browser check_ |

## Notes

A demo GIF lands here at milestone 15.
