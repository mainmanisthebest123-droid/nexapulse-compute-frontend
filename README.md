# NexaPulse Compute UI v0.5.0

React + TypeScript + Vite frontend for the NexaPulse Compute internal model-testing environment.

## v0.5.0 changes

- Removes the separate AI UI dashboard section; the existing ZIP/source workspace now lives under Projects.
- Keeps ZIP import/export and local source editing. Standalone HTML files can be previewed in a sandboxed iframe (`allow-scripts`, without same-origin access). Full React/Vite projects can be imported, inspected, edited and exported; executing/building arbitrary project bundles requires a separate isolated build runner and is not claimed here.
- Adds a Models playground with a model selector and authenticated `/v1/chat/completions` requests.
- Adds show/hide password controls to sign-in and registration.
- Keeps the green Worker connection dot beside the notification control and removes the separate API version/status strip.
- Replaces developer-oriented Settings with account email/password updates, sign-out and a protected account-deletion action.
- Adds the complete universal multi-model notebook agent to Docs with Copy and Download controls and wrapped code.
- Retains fixed mobile bottom navigation, the top brand header, viewport-safe notifications, self-service Supabase Auth registration, existing project editor and ZIP export.
- Dashboard overview remains free of fabricated statistics and information cards.

## Multi-model notebook format

For a single-model notebook, load variables named `model` and `tokenizer`.
For multiple models, define this mapping in the same model-loading cell before running the final agent cell:

```python
NEXAPULSE_MODELS = {
    "org/model-a": {"model": model_a, "tokenizer": tokenizer_a},
    "org/model-b": {"model": model_b, "tokenizer": tokenizer_b},
}
```

The final agent discovers the mapping, registers each model ID and serves model-specific completions through one notebook tunnel.

## Environment

```dotenv
VITE_COMPUTE_API_URL=https://nexapulse-compute.blacknick517.workers.dev
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
# Legacy fallback: VITE_SUPABASE_ANON_KEY
```

Never put the service-role key or private Worker secrets in frontend environment variables.

## Build

```bash
npm install
npm run build
```

Cloudflare Pages: Vite preset, build command `npm run build`, output directory `dist`.

## Backend requirement

The matching Worker release must include the multi-model registry, authenticated model listing and inference routing, and the self-service account deletion endpoint. Do not deploy this frontend against an older Worker and expect all controls to work.
