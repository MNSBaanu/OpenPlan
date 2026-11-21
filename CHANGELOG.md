# Changelog

All notable changes to OpenPlan are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Live collaboration.** Several people can edit one plan at the same time, with a separate undo for each person. It is end-to-end encrypted, and the relay (`collab-server/`) runs free on Cloudflare Workers.
- **Names, colours and comments in live sessions.** Each person chooses a name; the Share dialog and the title bar show who is here, a row someone else has selected carries their name, and comments on a task (in the details panel) merge cleanly when two people write at once. Redeploy the relay (`cd collab-server && npm run deploy`) to switch on names and colours; without it, the plan and comments still work.
- **Easier editing on the Gantt chart.** Bars are taller (14 px). Move the pointer over a bar and handles appear: grips on both edges (drag the left edge to change the start, the right edge to change the length), a round handle after the bar (drag it onto another bar to link them), and a small marker under the bar (drag it to set % complete). The pointer changes to show what a press will do, a tip shows the new date and length while you drag, and the bar you are about to link lights up. A 1-day bar keeps a middle you can grab to move it.
- **Microsoft Project XML import** (File › Open): tasks, outline, links with lag, constraints, resources, assignments and holidays. Anything that cannot be carried over is listed after the import.
- **Microsoft Project XML export** (File › Export). The output is checked against Microsoft's published schema, and a plan exported and imported again keeps the same dates.
- **Working week.** Choose which days the project works (a Sunday to Thursday week, a six-day week and so on) in Project Information. The schedule, the Gantt shading and the Microsoft Project import and export all follow it.
- **Currency picker** in Project Information, with a proper currency code that other programs use. A symbol can still be typed.
- **Printing that fits the paper.** File › Print asks for paper size and direction, splits a long Gantt chart over pages without cutting a row, repeats the date header on every page, and — for a very wide chart — repeats the task table on each sideways page. "Fit on one page" is still there.
- **Browser tests in the repository** (`npm run e2e`), run on every pull request.
- A real-screenshot preview on the landing page, with Reports as a fifth tab.
- Limits on durations and lags (5000 working days), so a typo can no longer freeze the page.
- Tests for the scheduler, costs, leveling, charts, templates, import and sharing.

### Changed
- **New look.** Warm paper, ink-black type and a dark brown accent, one font (Source Sans 3), thin rules and no drop shadows. The app and the landing page share it, and the layout adapts to phones and tablets.
- The logo and app icons are brown to match.
- Bar colour choices in the Format tab: brown (the default), green, indigo, amber and slate.
- The landing page text now says that live sessions are optional and encrypted.
- Moving a bar on the Gantt chart says what it did ("Start pinned: no earlier than …") and that Ctrl+Z undoes it.
- The two stylesheets are now one file (`src/styles.css`), 13 KB smaller, with no change to how anything looks (checked screen by screen).

### Fixed
- Clicking a card on the Task Board now opens the details panel.
- The Insert key adds a task while the cursor is in a task cell.
- A cell that has the cursor but no typing now shows other people's changes.
- Importing a task list with IDs such as `T-1` keeps the predecessor links.
- The offline cache no longer stores an error page, and an open tab recovers after a new deploy.
- The status bar no longer wraps over the last row on a phone.

## [2.0.0]

The React and TypeScript version of OpenPlan: Gantt chart, critical path, network diagram, WBS, resources and leveling, baselines and earned value, budget and reports, templates, import from Excel or CSV, share links and versions.
