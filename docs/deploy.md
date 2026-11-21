# Hosting your own copy

`npm run build` writes the whole app to `dist/`. It uses relative paths, so any static host works (GitHub Pages, Netlify, Vercel and so on). Opening `dist/index.html` directly from disk does not work in most browsers.

## Vercel, deployed automatically

`.github/workflows/vercel.yml` deploys to [Vercel](https://vercel.com). Every push to `main` goes to production, and every pull request gets a preview address.

One-time setup:

1. Create the Vercel project: import the repository at vercel.com/new, or run `npx vercel link` in the project folder.
2. Create a token at **vercel.com › Account Settings › Tokens**.
3. Find the IDs in `.vercel/project.json` (made by `vercel link`), or under **Project › Settings › General**.
4. In GitHub, open **Settings › Secrets and variables › Actions** and add three repository secrets:
   - `VERCEL_TOKEN`: the token
   - `VERCEL_ORG_ID`: the `orgId`
   - `VERCEL_PROJECT_ID`: the `projectId`

If you imported the repository into Vercel, turn off Vercel's own Git deployments (**Project › Settings › Git**), so each push deploys only once.

## Live sessions (optional)

Live collaboration needs the small relay in [`collab-server/`](../collab-server/README.md). Build with its address, for example
`VITE_COLLAB_URL=wss://your-relay.workers.dev npm run build`. Without it, the live-session button is hidden.

## Visitor counts

OpenPlan counts visitors with [GoatCounter](https://www.goatcounter.com), a free service that uses no cookies. The script tag is in `index.html`. It counts the landing page (`/`) and the app (`/app`) separately. Project data is never sent.

To use your own account, change `mnsbaanu` in the `data-goatcounter` address in `index.html` to your site code. GoatCounter ignores visits from `localhost`.

## Install as an app, and open files by double-clicking

In Chrome or Edge, install OpenPlan as an app. After that, double-clicking an `.openplan` file opens it in OpenPlan.

1. Open OpenPlan from an HTTPS address or from `localhost`.
2. Click the **Install** icon in the address bar, or choose **Cast, save and share › Install page as app**.
3. Double-click an `.openplan` file. The first time, choose **Allow**.
