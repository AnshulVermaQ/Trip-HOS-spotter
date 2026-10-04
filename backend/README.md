# RoadReady HOS backend

This Django service supplies the API expected by the React frontend.

**Live frontend:** https://trip-hos-spotter-r2pf.vercel.app/

**Live API health check:** https://trip-hos-spotter.vercel.app/api/health/

## Run locally

From this directory, create a virtual environment, install `requirements.txt`, then run:

```powershell
python manage.py migrate
python manage.py runserver
```

Set `VITE_API_BASE_URL=http://127.0.0.1:8000` in the frontend environment to use this service instead of its local demo planner.

## API

- `POST /api/trips/plan/` creates a trip plan and persists it.
- `GET /api/trips/<id>/logs/` returns that trip's generated daily logs.
- `PUT /api/trips/<id>/` saves user edits to a generated plan and its ELD logs.
- `GET /api/trips/` returns persisted trip history.
- `GET /api/health/` returns service health.

The scheduler models the assessment assumptions: property-carrying operations, 70-hour/8-day cycle, 11-hour driving limit, 14-hour driving window, an 8-hour driving-break trigger, 10-hour resets, one-hour pickup/dropoff, and fuel at 1,000-mile intervals. It is a planning aid, not a compliance system or legal advice.

Location data is packaged for deterministic geocoding. The planner requests live driving distance and full road geometry from OSRM/OpenStreetMap, then reduces the returned map geometry to at most 2,500 points while retaining the route shape and endpoints. If the routing service is unavailable, it returns an explicitly labelled offline estimate instead of silently claiming live routing. Set `OSRM_BASE_URL` to use a hosted or self-managed OSRM service.

## Deploy on Vercel

The `api/index.py` function and `vercel.json` make this directory deployable as a Vercel project. Vercel functions have an ephemeral read-only filesystem, so production must use PostgreSQL rather than the local SQLite database.

1. Create a managed PostgreSQL database (Neon, Supabase, or another provider) and copy its connection URL.
2. Create a Vercel project with this `backend` folder as its Root Directory.
3. Add every variable in `.env.production.example`, replacing the placeholders with your real backend URL, frontend URL, secret, and database URL.
4. Apply migrations against the production database once from a trusted machine:

   ```powershell
   $env:DATABASE_URL = "your-production-postgresql-url"
   $env:DJANGO_DEBUG = "false"
   $env:DJANGO_SECRET_KEY = "your-production-secret"
   python manage.py migrate
   ```

5. Redeploy the Vercel project after changing any environment variable.
