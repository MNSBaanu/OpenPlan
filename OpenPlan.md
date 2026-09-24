---
title: OpenPlan
aliases: [OpenPlan, Open Plan]
tags: [project, academic, topup, react, typescript, vite, project-management]
status: active
version: 2.0.0
created: 2026-09-24
updated: 2026-09-24
repo: https://github.com/MNSBaanu/OpenPlan
author: MNS Baanu
---

# OpenPlan

> [!summary]
> A free, browser-based project planner: WBS, Gantt chart, critical path (CPM), network diagram, resources, leveling, baselines, earned value, budget and reports. No server and no account. Projects live in localStorage and `.openplan` files.

## Quick links
- Source: [GitHub](https://github.com/MNSBaanu/OpenPlan)
- Setup and usage: [[README]]
- Licence: [[LICENSE]] (MIT)
- Coursework document: `ASE CW02.docx` (git-ignored)

## Tech stack
| Layer | Technology |
|---|---|
| UI | React 18, TypeScript |
| State | Zustand (`src/store.ts`) |
| Build | Vite 6 (`base: './'`) |
| Engine and charts | Plain JS modules rendering SVG strings (`src/core/`) |
| Storage | localStorage + File System Access API |
| Hosting | Vercel via GitHub Actions |
| Analytics | GoatCounter (no cookies) |

## Commands
```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit
npm run build      # tsc + vite build -> dist/
npm run preview    # http://localhost:4173
```

## Structure
```
src/
├── core/        core.js (utils, calendar, model, CPM scheduler, leveling)
│                io.js (JSON, CSV, SVG/PNG export, print)
│                charts.js (Gantt, network, WBS, org, cost charts)
│                demo.js (sample project)
├── components/  Chrome (title/status bar, backstage), Ribbon, Drawer, Dialogs, Field, Icon
├── views/       GanttView, Diagrams, Sheets, BudgetView, ReportsView, Landing
├── lib/         actions.ts (file I/O), grid.ts (columns/filter/group/sort), taskOps.ts (commands)
├── store.ts     app state, undo/redo, autosave
├── App.tsx      layout + keyboard shortcuts
└── main.tsx     entry, hash routing (#app = app, else landing)
```

## How it works
- **Routing:** `location.hash === '#app'` shows the app. Anything else shows the landing page.
- **State:** every project change goes through `commit(fn)`. The project is deep-cloned, mutated, rescheduled with `OP.schedule` and pushed to undo (max 100 steps). It is then autosaved to `localStorage['openplan.project']` after a 300 ms debounce, and flushed on `pagehide`. The project replaced by New, Open or Sample is kept in `openplan.project.previous`, and UI prefs are stored in `openplan.ui` (type-checked on load). Other tabs sync through the `storage` event. Views subscribe through `useApp()`, which ignores toasts, menus and dialogs.
- **Scheduling (CPM):** forward pass (ES/EF), backward pass (LS/LF), then total and free slack. Dates are whole day numbers (days since 1970, UTC). The working calendar is Mon–Fri minus holidays. Summary links expand into leaf-to-leaf edges, and loops are found with Kahn's algorithm.
- **Supported:** FS/SS/FF/SF links with lag, constraints (ASAP, ALAP, SNET, SNLT, FNET, FNLT, MSO, MFO), deadlines, splits, recurring tasks, task types (fixed units/work/duration), effort-driven tasks.
- **Resources:** Work, Material and Cost kinds, with rate tables, cost per use, work days and vacations. Serial leveling sets `levelDelay`.
- **Tracking:** baseline, % complete, actual dates, status date, and earned value (BCWS, BCWP, ACWP, SPI, CPI, EAC).
- **Rendering:** charts are SVG strings injected with `dangerouslySetInnerHTML`. Every user value, including `data-uid`, goes through `esc()`, and files are type-checked by `model.normalize`. A CSP in `vercel.json` adds a second layer. An error boundary in `main.tsx` offers backup download and a view reset.

## File formats
| Format | Import | Export |
|---|---|---|
| `.openplan` / `.json` | ✅ | ✅ |
| CSV | ❌ | ✅ |
| PNG / SVG / Print-to-PDF | — | ✅ |

## Deployment
- Every push to `main` deploys to production on Vercel. Pull requests get preview deploys (`.github/workflows/vercel.yml`).
- Needed secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

## Open issues
> [!todo] Remaining after the 2026-09-24 audit fixes
> - [ ] Add automated tests (Vitest) for the scheduler, leveling and XML round trip
> - [ ] Add ESLint with `react-hooks`
> - [ ] Offline support (service worker) for the installable app
> - [ ] Type the JS engine API (`src/core/index.d.ts` still exports `any`)
> - [ ] Move Gantt drag state and file handle out of module-level variables
> - [ ] Undo keeps up to 100 full JSON snapshots (memory on large plans)
> - [ ] Dates show 2-digit years (kept for narrow chart cells)

## Log
- **2026-09-24** Full audit completed. Created this note.
- **2026-09-24** Fixed the audit findings:
  - **Security:** XSS through `uid`, CSV formula injection, CSP and security headers, file validation.
  - **Data safety:** unreadable-autosave backup, sync between tabs, error boundary, previous-project restore.
  - **Correctness:** date validation, monthly clamp, MS Project XML times and holidays, PNG size limit, budget KPI, assignment units, custom fields, critical links for all link types, cost by day.
  - **Performance:** binary-search calendar, cheaper loop check, selection overlay, shallow store subscriptions.
  - **Accessibility:** zoom buttons, menus, keyboard access to chart nodes, labelled cells.
  - **Tooling:** Vite 6, pinned CI, MIT licence.
  - Remaining items are listed under Open issues. `AUDIT.md` was deleted.
- **2026-09-24** Landing page upgrade: stats row, "Who it's for", FAQ, and an "Open source under the MIT License" mention in the footer. Square corners everywhere, new logo.
- **2026-09-24** Removed MS Project XML import/export and the .mpp/.pod export dialogs. Logo shown without a background tile; footer centred.
