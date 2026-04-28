# Agarwal Medical Ecommerce Website

Full-stack healthcare equipment rental and sales website for Rahul Agarwal's Agarwal Medical.

## Run

```powershell
node server.js
```

If the system Node is old or unavailable, use the bundled Codex runtime:

```powershell
& "C:\Users\Rahul Agarwal\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
```

To start it in the background:

```powershell
Start-Process -WindowStyle Hidden -FilePath powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"C:\Users\Rahul Agarwal\OneDrive\Documents\New project\start-server.ps1`""
```

Open:

```text
http://localhost:3000
```

## Vercel Deploy

This project includes Vercel serverless API functions in `api/`. See `VERCEL_DEPLOYMENT.md` before deploying live.

Admin enquiries:

```text
http://localhost:3000/admin-login.html
```

Default local admin login:

```text
Username: rahul
Password: admin123
```

Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables before starting the server to change these.

## Included

- Frontend product catalog for rent and sale
- Search, category filter, rent/sale filter
- Enquiry cart and patient details form
- Admin enquiry dashboard
- Backend API using Node's built-in HTTP server
- JSON database at `data/db.json`
- Project hero image at `assets/healthcare-hero.png`

## API

- `GET /api/company`
- `GET /api/products?mode=rent&category=Respiratory%20Care&search=oxygen`
- `POST /api/enquiries`
- `GET /api/enquiries`
- `GET /api/prescriptions/:fileName`
