# Push this frontend update to GitHub

1. Download and extract `NexaPulse_Compute_UI_v0.3.0.zip`.
2. Open the extracted project folder in your Git client or terminal.
3. Push the contents into the existing NexaPulse Compute **frontend** repository (do not mix these files into the Worker backend folder).

Terminal commands:

```bash
git add .
git commit -m "Update NexaPulse Compute dashboard to v0.3.0"
git push
```

Before building or deploying, create `.env.local` from `.env.example` and add the Supabase project URL and public anon key. Never add `.env.local` to Git.

Cloudflare Pages should build the frontend with `npm run build` and publish `dist/`.
