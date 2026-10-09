# Build brief (agreed 2026-10-08)

**Pitch:** ₹800 tells an outdoor worker how to arrange the jobs they already have around the day's heat, and says plainly when their income target can't be met without breaking the heat rules.

**User:** independent electrician or plumber in Lucknow with a few bookings, some flexible, some outdoors. Prefers Hindi. Budget Android.

**Problem:** heat advice says "avoid outdoor work". That costs money the worker needs today. Nothing combines their jobs, their target and the forecast.

**Core workflow**
1. Set income target and workday.
2. Say or type the day's jobs in Hindi or English. Bedrock extracts structured jobs. The worker reviews and edits every field before planning.
3. Backend (Lambda) screens hourly weather with the NWS heat index, applies the prototype heat policy and runs OR-Tools CP-SAT.
4. Result: timeline with travel and recovery blocks, income vs target, exposure score vs the day as booked, a reason for every scheduled and unscheduled job.
5. Slide the temperature (-2 to +6 °C). The backend re-solves. Before/after shows what changed and why.

**Integrations**
- AWS Lambda (FastAPI via Mangum, zip deploy, no Docker), API Gateway HTTP API, DynamoDB (plans), Bedrock (job extraction only), Amplify Hosting (static Next.js), CloudWatch logs.
- Open-Meteo for live forecasts. Demo mode uses a labelled synthetic heatwave fixture.

**Rule that never bends:** Bedrock never decides eligibility, timing or safety. The solver and the deterministic policy do. The income target never relaxes a hard restriction.

**Excluded:** job and session CRUD endpoints (jobs live in the browser and go with each request), accounts, payments, marketplace, PWA/offline, notifications, multi-worker.

**Demo outline (≤180 s):** conflict hook, speak four jobs in Hindi, plan reaches ₹800, slide +5 °C, re-solve drops the rooftop job, ₹650 with ₹150 shortfall and the reason, AWS proof (Lambda logs, DynamoDB item, Bedrock call), Hindi mobile view.

**First risky assumption:** the demo fixture produces ₹800 at +0 °C and ₹650 at +5 °C from the real solver. Covered by a test.
