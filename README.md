# Code Concept Visualizer

Write Python, watch it run — step by step, as an animation you control.

Beginners learn control structures by reading static code, which never builds intuition for what
happens at runtime. This tool takes Python **you** write, executes it in the browser with real
CPython (Pyodide, compiled to WebAssembly), and turns the execution into a step-controllable,
gamified animation — without anyone having hand-scripted an animation for that specific example.

> **Status: milestone 1 of 15 — scaffold, CI and deployment.** The visible app starts at milestone 5.
> Progress and the full spec are in [`docs/PLAN_v2.md`](docs/PLAN_v2.md).

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

## Notes

Start-up timings land here at milestone 3, and a demo GIF at milestone 15.
