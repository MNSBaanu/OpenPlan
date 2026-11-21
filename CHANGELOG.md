# Changelog

All notable changes to OpenPlan are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Live collaboration.** Several people can edit one plan at the same time, with a separate undo for each person. It is end-to-end encrypted, and the relay (`collab-server/`) runs free on Cloudflare Workers.
- **Microsoft Project XML import** (File › Open): tasks, outline, links with lag, constraints, resources, assignments and holidays. Anything that cannot be carried over is listed after the import.
- **Browser tests in the repository** (`npm run e2e`), run on every pull request.
- A real-screenshot preview on the landing page, with Reports as a fifth tab.
- Limits on durations and lags (5000 working days), so a typo can no longer freeze the page.
- Tests for the scheduler, costs, leveling, charts, templates, import and sharing.

### Changed
- **New look.** Warm paper, ink-black type and a dark brown accent, one font (Source Sans 3), thin rules and no drop shadows. The app and the landing page share it, and the layout adapts to phones and tablets.
- The logo and app icons are brown to match.
- Bar colour choices in the Format tab: brown (the default), green, indigo, amber and slate.
- The landing page text now says that live sessions are optional and encrypted.

### Fixed
- Clicking a card on the Task Board now opens the details panel.
- The Insert key adds a task while the cursor is in a task cell.
- A cell that has the cursor but no typing now shows other people's changes.
- Importing a task list with IDs such as `T-1` keeps the predecessor links.
- The offline cache no longer stores an error page, and an open tab recovers after a new deploy.
- The status bar no longer wraps over the last row on a phone.

## [2.0.0]

The React and TypeScript version of OpenPlan: Gantt chart, critical path, network diagram, WBS, resources and leveling, baselines and earned value, budget and reports, templates, import from Excel or CSV, share links and versions.
