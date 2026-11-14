# Push this frontend update to GitHub

1. Extract `NexaPulse_Compute_UI_v0.4.0.zip`.
2. Push the contents into the existing NexaPulse Compute **frontend** repository.

```bash
git add .
git commit -m "Update NexaPulse Compute dashboard to v0.4.0"
git push
```

Before building, create `.env.local` from `.env.example` with your Worker URL and Supabase public credentials. Never commit `.env.local`.

Cloudflare Pages: build command `npm run build`, output directory `dist`.
