![OpenPlan](public/assets/openplan-logo.svg)

A free project planner that runs in the browser. You can use it to build a WBS, a Gantt chart, a critical-path network diagram, a resource plan and a budget without a paid licence.

## Features

- **Gantt chart**: an outline of summary tasks and subtasks, FS/SS/FF/SF links with lag, milestones, constraints, deadlines, split tasks and a timeline strip. You can drag bars to move tasks, resize them or link them.
- **Critical path**: forward and backward passes that give ES, EF, LS, LF, total slack and free slack.
- **Network diagram** (activity on node), **WBS chart** and **team org chart**. Each one exports to PNG or SVG.
- **Resources**: work, material and cost resources, calendars, vacations, rate changes, the workload heatmap and resource leveling.
- **Tracking**: baselines, % complete, actual dates, a status date and earned value (SPI, CPI, EAC).
- **Budget and reports**: cost by work package and by resource, monthly and cumulative cost, and 10 ready-made reports.
- **Office-style interface**: a ribbon, a backstage File menu, keyboard shortcuts, undo and redo, and dark mode.

## Getting started

You need [Node.js](https://nodejs.org) 18 or later.

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build:

```bash
npm run build      # outputs to dist/
npm run preview    # serves dist/ locally
```

`dist/` uses relative paths, so you can host it anywhere static files are served, such as GitHub Pages or Netlify. Opening `dist/index.html` directly from disk does not work in most browsers.

## Where your data is stored

OpenPlan has no server or database. Your work stays on your own computer.

- **Autosave**: every change is saved in the browser's localStorage. That copy exists only in the browser and computer you are using, and clearing your browser data deletes it.
- **Project files**: **File › Save** (Ctrl+S) writes an `.openplan.json` file. In Chrome and Edge, the first save asks where to put the file, and later saves write back to that same file. **Save As** makes a copy. Other browsers download the file instead.
- **File › Open** loads an `.openplan.json` file or a project XML file.

Keep a project file for anything important.

## Import and export

| Format | Support |
|---|---|
| Project XML (`.xml`) | Import and export |
| `.mpp` / `.pod` | Export the XML, then open it in a desktop project tool and use **Save As**. Browsers cannot write these binary formats. |
| CSV | Export the task list |
| PNG / SVG / PDF | Chart images, and printing to PDF |

## Keyboard shortcuts

| Keys | Action |
|---|---|
| Ctrl+S | Save |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Alt+Shift+→ / ← | Indent / outdent the selected tasks |
| Insert | Insert a task |
| Delete | Delete the selected tasks |
| ↑ / ↓ | Move between rows while editing |

## Tech stack

React 18, TypeScript, Vite and Zustand. The scheduling engine and chart renderers are plain JavaScript modules in `src/core/`.

```
src/
  core/        scheduling engine, MSPDI/CSV import-export, SVG charts, sample project
  components/  ribbon, title/status bar, backstage, dialogs, task details panel
  views/       Gantt, network/WBS/org diagrams, resource sheet, workload, budget, reports
  lib/         task commands, grid columns/filters, file actions
  store.ts     app state, undo/redo, autosave
```

