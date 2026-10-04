# Spotter HOS Trip Planner

Live application: https://trip-hos-spotter-r2pf.vercel.app/

API health check: https://trip-hos-spotter.vercel.app/api/health/

## What it does

Enter a current location, pickup location, dropoff location, the driver's eight-day duty history, a local start time, and a planning speed. The application generates a road route, scheduled compliance stops, daily ELD log sheets, and saved trip history.

## HOS modeling assumptions

- Property-carrying operation using a rolling 70-hour / 8-day cycle calculated from eight entered daily on-duty totals
- 11-hour driving limit and a 14-hour duty window that includes driving, pickup, fuel, and dropoff time after a qualifying 10-hour reset
- 30-minute qualifying interruption after 8 cumulative driving hours
- 10-hour daily reset and a 34-hour restart when the 70-hour cycle is exhausted
- Driver-selected 35–75 mph modeled driving speed (55 mph is the default)
- One hour each for pickup and dropoff
- Fuel planned at least every 1,000 route miles
- No adverse-driving or other HOS exceptions modeled

This is a planning aid, not a certified ELD or legal compliance system.

## Run locally

### Backend

```powershell
cd backend
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE_URL=http://127.0.0.1:8000` in `frontend/.env` to use the Django API locally.

## Deployment

The frontend and backend are separate Vercel projects. The Django API uses PostgreSQL in production because serverless function files are not persistent. See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) for the required environment variables and setup steps.
