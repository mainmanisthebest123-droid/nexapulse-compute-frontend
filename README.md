# NexaPulse Compute UI

React + TypeScript + Vite dashboard for the internal NexaPulse Compute model-testing workspace.

## Included in this update

- Light, responsive workspace dashboard with runtime health, activity, environment and recent-event sections.
- Persistent tab navigation: switching sections does not unmount the other sections or discard their component state.
- IndexedDB-backed project ZIP import, file explorer, source editing, unsaved draft persistence, and updated ZIP export.
- Unsaved-change warning before leaving the page and Ctrl/Cmd+S to save the selected source file.
- Compute connections page with Supabase owner sign-in, pending enrollment listing, and approve/reject actions against the Compute Worker.
- Model registry, analytics, settings and documentation views.
- No fake runtime or analytics numbers: unavailable metrics are shown as unavailable until a real API endpoint exists.

## Requirements

- Node.js 20 or newer recommended.
- A deployed NexaPulse Compute Worker exposing `/health`, `/v1/enrollments`, `/v1/enrollments/{id}/approve`, `/v1/enrollments/{id}/reject` and the enrollment heartbeat path.
- A Supabase project with Auth enabled and the public anon key available for the browser client.

## Local development

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your Worker URL and Supabase public credentials
npm run dev
```

## Build

```bash
npm run build
```

Output is written to `dist/`.

## Notes and limitations

- The UI is an internal control surface. It is not a public marketplace or public model gateway.
- Browser model inference stays disabled until a protected browser access layer and signed Worker-to-notebook inference channel are implemented and tested. Do not expose `NP_CONTROL_TOKEN` or other private Worker credentials to browser code.
- Kaggle and Colab runtimes are temporary and provider-managed. This UI does not bypass provider idle limits or guarantee a session remains alive.
- ZIP contents are stored locally in IndexedDB. Imported project code is not uploaded, installed, executed, or previewed in this build. An isolated preview runner is a separate integration.
- Analytics panels intentionally show unavailable states until the Worker exposes real metrics. No fabricated usage, uptime, TFLOPS, or health percentages are displayed.

## Deployment

Build the app with `npm run build` and deploy the generated `dist/` directory to the existing Cloudflare Pages project. Keep the Cloudflare Worker backend separate from this frontend repository.

## Push to GitHub

Extract this ZIP into the root of your frontend repository, then run:

```bash
git add .
git commit -m "Update NexaPulse Compute dashboard to v0.3.0"
git push
```

This is the frontend only. Keep the Cloudflare Worker/backend project separate.
