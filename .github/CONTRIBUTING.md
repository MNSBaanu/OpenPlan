# Contributing to OpenPlan

Thank you for helping. OpenPlan is a free, browser-based project planner, and small fixes are as welcome as new features.

## Set up

You need [Node.js](https://nodejs.org) 22.12 or later.

```bash
git clone https://github.com/MNSBaanu/OpenPlan.git
cd OpenPlan
npm install
npm run dev          # http://localhost:5173
```

## Check your change

Run these before you open a pull request. The same checks run on every pull request.

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm test             # unit tests (Vitest)
npm run build        # production build
```

CI also runs `npm audit --omit=dev --audit-level=high` on every pull request to report high or critical dependency vulnerabilities. That step is non-blocking for now, so read its output and update a dependency when it reports a problem.

The browser tests drive the built app in a real browser. Install the browser once, then run them:

```bash
npx playwright install chromium
npm run e2e                # all suites, about 3 minutes
npm run e2e -- editing     # only suites whose file name contains "editing"
```

A failing test prints the step that failed. The suites are in `e2e/`; each one is a short script that uses the helpers in `e2e/lib.cjs`.

## Where things are

| Folder | What it holds |
|---|---|
| `src/core/` | The scheduling engine, file formats and SVG charts (plain JavaScript) |
| `src/lib/` | Task commands, import and export, templates, sharing, versions |
| `src/components/`, `src/views/` | The interface |
| `src/collab/` | Live collaboration: encryption, shared plan, connection |
| `collab-server/` | The relay for live sessions (Cloudflare Worker) |
| `e2e/` | Browser tests |
| `src/styles.css` | The look of the app and the landing page (colours and fonts are variables at the top) |

## Guidelines

- By sending a pull request you confirm that you wrote the work yourself (or have the right to share it) and that it may be released under the project's [MIT License](../LICENSE). Do not copy code, text, images or fonts from other sources unless their license allows it. If you add a library, run `npm run notices` and commit the updated `public/third-party-notices.txt`.
- Keep a pull request to one change, and say what it does and why.
- Add or update a test when you fix a bug or add a feature. A scheduling change needs a unit test in `src/core/`.
- Write plain English in the interface and the docs. Short sentences are best.
- Do not commit secrets, tokens or personal data. The live-session relay address is public and is the one value that is committed.
- Commit messages start with a short summary line, such as `fix: keep links on dashed IDs`.

## Try live collaboration on your computer

```bash
cd collab-server && npm install
npm run dev -- --var ALLOWED_ORIGINS:http://localhost:4173     # the relay, on ws://localhost:8787
```

In the main folder, build with the relay address and serve it:

```bash
VITE_COLLAB_URL=ws://localhost:8787 npm run build && npm run preview
```

## Report a problem

Open an issue and use the template. A screenshot, the steps to repeat it, and your browser name help most. For a security problem, see [SECURITY.md](SECURITY.md).
