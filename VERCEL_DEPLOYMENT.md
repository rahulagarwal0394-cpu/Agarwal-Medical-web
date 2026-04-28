# Agarwal Medical Vercel Deployment

This project is now Vercel-ready:

- Static website files live in `public/`
- Serverless API functions live in `api/`
- Product images are available under `public/assets/`
- Local development can still use `node server.js`

## Required Vercel Environment Variables

Set these in Vercel Project Settings > Environment Variables:

```text
ADMIN_USERNAME=rahul
ADMIN_PASSWORD=choose-a-strong-password
ADMIN_SECRET=choose-a-long-random-secret
POSTGRES_URL=provided-by-vercel-postgres-or-neon
```

`POSTGRES_URL` is required for live persistent enquiries. Without it, Vercel functions cannot permanently save new enquiries because deployment files are read-only/temporary.

## Recommended Setup

1. Push this folder to GitHub.
2. Import the GitHub repo in Vercel.
3. Add Vercel Postgres or Neon Postgres to the project.
4. Add the environment variables above.
5. Deploy.

## URLs

```text
Website: / 
Admin login: /admin-login.html
Admin enquiries: /admin.html
```

## Local Run

```powershell
cd "C:\Users\Rahul Agarwal\OneDrive\Documents\New project"
& "C:\Users\Rahul Agarwal\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
```

Open:

```text
http://localhost:3000
```
