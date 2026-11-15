# Push NexaPulse Compute UI v0.4.1

1. Extract the ZIP into the root of the existing frontend repository, replacing the previous frontend files.
2. Commit and push:

```bash
git add .
git commit -m "Refresh Compute dashboard, navigation and authentication"
git push
```

3. In Cloudflare Pages, configure `VITE_COMPUTE_API_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY`. The legacy `VITE_SUPABASE_ANON_KEY` remains supported as a fallback. Use a public key from the same Supabase project as the URL.
4. Build command: `npm run build`; output directory: `dist`; root directory: blank.
5. Confirm Supabase Auth email confirmation settings match your intended registration flow.

Never add `SUPABASE_SERVICE_ROLE_KEY`, `NP_OWNER_USER_IDS`, `NP_CONTROL_TOKEN`, or node signing keys to the Pages frontend. Those belong only in protected backend configuration.
