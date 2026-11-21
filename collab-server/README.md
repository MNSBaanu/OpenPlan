# OpenPlan live-session relay

A very small server that lets people edit the same OpenPlan plan at the same time. It runs on the
**free Cloudflare Workers plan** (no card needed).

## What it does, and does not do

- It stores and forwards **encrypted** messages only. The key lives in the invite link after `#`, which
  browsers never send to a server, so the relay cannot read your plan.
- It can see: the random room name, how big and how often messages are, and the connecting IP addresses
  (as any web host can).
- It keeps no accounts. A room is deleted 30 days after its last change.
- Limits per room: 5 MB stored, 900 KB per message, 600 messages per 10 seconds per person.

## Deploy (about 10 minutes)

1. Create a free account at [cloudflare.com](https://dash.cloudflare.com/sign-up).
2. In this folder:

   ```bash
   npm install
   npx wrangler login
   ```
3. Open `wrangler.toml` and set `ALLOWED_ORIGINS` to the address of your OpenPlan site
   (for example `https://openplan-xi.vercel.app`). Separate several with commas. Only these sites can open a room,
   which stops other websites from using up your free quota.
4. Deploy:

   ```bash
   npm run deploy
   ```

   It prints an address like `https://openplan-collab.YOUR-NAME.workers.dev`.
5. Tell OpenPlan where the relay is. Put the address in `.env.production` in the main folder
   (`VITE_COLLAB_URL=wss://openplan-collab.YOUR-NAME.workers.dev`) and in the `connect-src` list in `vercel.json`, then push.
   The address is not a secret. Without it the "Start a live session" button stays hidden.

Open the app, click the link button in the title bar, and choose **Start a live session**.

## Free-plan limits

Cloudflare's Workers Free plan allows about 100,000 requests a day and 5 GB of Durable Object storage in total,
and nothing is charged: if a limit is reached, live sessions stop working until the daily reset (00:00 UTC) and the
rest of OpenPlan carries on as usual, because every plan is also saved in the browser. Check
[Cloudflare's current limits](https://developers.cloudflare.com/durable-objects/platform/limits/) and how WebSocket
messages are counted, as they can change. The browser keeps the relay's history short by merging it when it grows.

## Try it on your computer

```bash
npm run dev -- --var ALLOWED_ORIGINS:http://localhost:4173     # the relay, on ws://localhost:8787
npm test                                                       # protocol tests (in another terminal)
```

To try the whole thing, build OpenPlan with the relay address and serve it:

```bash
VITE_COLLAB_URL=ws://localhost:8787 npm run build && npm run preview     # in the main folder
```

## How the pieces fit

| Part | Where | Job |
|---|---|---|
| Relay | `collab-server/src/index.js` | One Durable Object per room keeps an append-only log of encrypted updates |
| Encryption | `src/collab/crypto.ts` | AES-GCM 256 with a fresh random IV for each message |
| Shared plan | `src/collab/ydoc.ts` | Stores the plan in a Yjs document so edits merge field by field |
| Session | `src/collab/session.ts` | Connects, reconnects, merges, and keeps a separate undo for each person |

Each person allocates task numbers from their own range, so two people adding a task at the same moment never clash.
