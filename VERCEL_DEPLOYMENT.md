# Deploy RoadReady on Vercel

Create **two Vercel projects from the same repository**. Use the indicated folder as each project's Root Directory; do not deploy the parent folder as one project.

| Project | Root Directory | Framework / build | Required environment variables |
| --- | --- | --- | --- |
| `roadready-api` | `backend` | Other / Python | `DJANGO_DEBUG=false`, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `DATABASE_URL`, `OSRM_BASE_URL` |
| `roadready-web` | `frontend` | TanStack Start (auto-detected) | `VITE_API_BASE_URL=https://your-api.vercel.app` |

## 1. Deploy the API

1. Create a managed PostgreSQL database. SQLite is only for local development because Vercel functions cannot retain files between requests.
2. In Vercel, import the repository and set **Root Directory** to `backend`.
3. Add the values from `backend/.env.production.example`. In particular:
   - `DJANGO_ALLOWED_HOSTS=your-api.vercel.app`
   - `CORS_ALLOWED_ORIGINS=https://your-web.vercel.app`
   - `DATABASE_URL` is the complete PostgreSQL connection URL.
4. Run `python manage.py migrate` once with those production database settings, as shown in `backend/README.md`.
5. Deploy and check `https://your-api.vercel.app/api/health/` returns JSON.

## 2. Deploy the web app

1. Import the same repository again and set **Root Directory** to `frontend`.
2. Add `VITE_API_BASE_URL=https://your-api.vercel.app` for Production, Preview, and Development as appropriate.
3. Deploy, then create a trip. The browser Network panel should show a successful `POST` to `https://your-api.vercel.app/api/trips/plan/`.

## Important details

- `VITE_*` variables are embedded in browser JavaScript. Only put the public API URL there—never a secret or database URL.
- Update the API's `CORS_ALLOWED_ORIGINS` whenever the frontend domain changes, including a custom domain.
- Environment-variable edits need a new deployment before they take effect.
- The routing lookup uses the public OSRM service by default. For a high-volume production service, configure `OSRM_BASE_URL` with a provider you control.
