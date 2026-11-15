# Push NexaPulse Compute UI v0.5.0

1. Extract the ZIP into the root of the existing frontend repository, replacing the previous frontend files.
2. Commit and push:

```bash
git add .
git commit -m "Update NexaPulse Compute UI to v0.5.0"
git push
```

3. In Cloudflare Pages, configure `VITE_COMPUTE_API_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY`. The legacy `VITE_SUPABASE_ANON_KEY` remains supported as a fallback.
4. Build command: `npm run build`; output directory: `dist`; root directory: blank.

Never add service-role keys or Worker secrets to the Pages frontend.
