# NexaPulse Compute UI v0.4.1

Clean React + TypeScript + Vite frontend for the NexaPulse Compute internal model-testing environment.

## Changes in v0.4.1

- Fixes Supabase client configuration to prefer `VITE_SUPABASE_PUBLISHABLE_KEY`, while retaining `VITE_SUPABASE_ANON_KEY` as a fallback.
- Validates the Supabase project URL and public-key format before attempting authentication, and gives a more useful error when the API rejects the key.
- Removes the dashboard information-card grid and extra informational callout cards.
- Moves primary navigation to a fixed bottom bar while keeping the NexaPulse header at the top.
- Constrains the notification panel to the viewport with scrolling and a close control.

## Changes in v0.4.0

- Removed the left sidebar; primary sections now use the top navigation bar.
- Added Supabase Auth account creation alongside sign-in on the Compute access screen.
- Added browser session persistence for the Supabase access token; sign out clears it.
- Removed hard-coded model cards, runtime/provider examples, configured-model counts and project examples from the dashboard.
- Model registry requests `GET /v1/models` and displays only records returned by the Worker, with loading/error/empty states.
- Dashboard reports only the Worker health response; it does not infer database or runtime health from `/health`.
- Existing ZIP import, local source editing, IndexedDB draft persistence and ZIP export remain available.
- Cloud project synchronization and isolated execution are not represented as available.

## Environment variables

Set these in Cloudflare Pages build environment variables (or `.env.local` locally):

```dotenv
VITE_COMPUTE_API_URL=https://nexapulse-compute.blacknick517.workers.dev
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
# Legacy fallback also supported: VITE_SUPABASE_ANON_KEY
```

Only the Supabase publishable/anon key belongs in the frontend. Never expose the service-role key, Worker secrets, node private keys or owner control tokens in Vite variables.

## Authentication notes

- Create Account calls Supabase Auth `/auth/v1/signup`.
- Sign In calls `/auth/v1/token?grant_type=password`.
- If email confirmation is enabled, users must confirm their email before signing in.
- Registration does not grant owner privileges. The Worker must enforce its owner UUID allowlist for enrollment management.
- The access token is stored in browser localStorage for session continuity. Sign out clears the local token.

## Build and deploy

```bash
npm install
npm run build
```

Cloudflare Pages: Vite preset, `npm run build`, output directory `dist`, root directory blank.

The frontend and Cloudflare Worker remain separate projects.

## Backend boundaries

- `/health` confirms Worker reachability only.
- `/v1/models` must return a JSON array or `{ "models": [] }`; otherwise the UI reports the endpoint error instead of inventing model records.
- Compute owner enrollment endpoints remain protected by Supabase authentication and the Worker owner allowlist.
- Model inference remains disabled until a signed Worker-to-notebook inference channel is implemented and verified.
- Notebook sessions remain temporary and subject to Kaggle/Colab provider limits.
- Imported project code is stored locally in IndexedDB; it is not uploaded, executed or previewed. An isolated runner is a separate backend service.
