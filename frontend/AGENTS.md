<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- HOS scheduling logic lives in src/lib/hos/engine.ts and mock data in src/lib/hos/mock-data.ts; UI never computes HOS rules itself — keeps calculations auditable and swappable for the Django backend.
- All data access goes through src/lib/api/hos-api.ts (uses VITE_API_BASE_URL when set, else the local mock) — single seam for backend integration.
- Keep the nationwide US location catalog and simplified state geometry as local frontend fixtures, with the existing typed HOS API adapter unchanged — demo planning remains self-contained until live geocoding/routing is connected.

- Print a selected ELD log by cloning only its sheet into a transient print root and hiding the app during print — prevents the planner and navigation from appearing on paper.
- Driver ELD edits mutate the plan's duty events through the local edit-log module, then rebuild daily sheets with the HOS engine; event history remains the auditable source of graph, totals, and warnings until the backend persists edits.
