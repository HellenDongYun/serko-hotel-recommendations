# Repository context

This is a four-hour Serko take-home assignment. The total limit includes setup,
agent wait time, implementation, verification, Git operations, and write-up.
Track actual time and stop at the cap; report incomplete work honestly.

## Layout and current stage

- `frontend/`: React, Next.js App Router, TypeScript, and Tailwind CSS app.
- `backend/`: small Python FastAPI API using local synthetic fixtures.
- `openapi.yaml`: handwritten, contract-first API specification. Read it before implementation.
- `frontend/.env.example`: safe public API URL configuration.
- `README.md` and `APPROACH.md`: required delivery records, to be created later.

The FastAPI backend and frontend request states, hotel cards, and selection are
implemented. Real-browser verification with both services remains pending. The
handwritten contract predates implementation and remains the source for contract checks.

## Agreed scope and behaviour

Build one page where a traveller enters a hotel request, sees loading, reviews
the assistant message and hotel cards, and selects one hotel with a clear summary.
Show name, nightly price, currency, breakfast availability, and explanation.
Support a usable small-screen layout and keyboard access.

`POST /recommendations` accepts `{message, scenario}`. Both fields are required.
The message must be a string containing a non-whitespace character; scenario is
`success`, `empty`, or `error`. Invalid requests return HTTP 422. Success returns
all three exact fixtures after a short delay; empty returns no hotels; error
always returns HTTP 503 with a readable `detail` string. Label responses as
synthetic fixture data. The demo scenario selects the outcome; no natural-language
interpretation is performed. The exact schemas and fixtures are in `openapi.yaml`.

Preserve the traveller's visible input after a failure. Manual Retry sends the
last submitted message with the currently selected demo scenario, even if the
visible message has subsequently been edited. Switching Error to Success then
clicking Retry must recover; Error continues to return 503. No automatic retry.
Clear previous results and hotel selection when any new request begins.

No live model, streaming, scraping, real booking, authentication, database,
deployment, or Serko system access is required. Use public packages. Keep
credentials, personal information, and confidential material out of all records.

## Run and check commands

Backend commands (run from repository root):

```sh
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
backend/.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
backend/.venv/bin/python -m pytest backend/tests -q
# In another terminal while Uvicorn is running:
backend/.venv/bin/python backend/check_http.py
```

Backend runtime: Python 3.12.8, FastAPI 0.163.0, Uvicorn 0.54.0,
Pydantic 2.14.3. `backend/requirements.txt` pins the installed environment,
including test dependencies. CORS permits `http://localhost:3000` for POST with
Content-Type. Record runtime versions and complete install/run/check instructions
in README.md at the documentation stage.

Frontend commands (run from repository root; Node.js v22.22.2, npm 10.9.7):

```sh
npm --prefix frontend ci
cp frontend/.env.example frontend/.env.local
npm --prefix frontend run dev
npm --prefix frontend test
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

Copy the environment example only on initial setup, preserving any existing local
configuration. Next.js reads `NEXT_PUBLIC_API_BASE_URL` from `.env.local`; restart
after changing it. The frontend runs at `http://localhost:3000`. Package versions
are recorded in `frontend/package-lock.json`. Tests replace fetch at the network
boundary; they do not verify the real API or browser layout/keyboard behaviour.

Planned checks: Vitest and Testing Library for focused frontend state/component
checks; API validation and contract checks; TypeScript, lint, and production build
as configured; real-browser success, loading, empty and 503 recovery checks;
small-screen and manual keyboard verification.

The recovery check must submit Error, observe 503, confirm input preservation,
switch to Success, click Retry, assert the original submitted message and
`scenario: "success"` in the second request, and verify all three cards return.
Document mock boundaries and anything unverified.

## Agent workflow

1. Read this file and `openapi.yaml` at the start of implementation; explicitly
   report that they were loaded so this context file's use is observable.
2. State a short plan, expected file changes, and checks before editing.
3. Implement the agreed scope. Ask before changing the agreed contract or scope.
4. Run focused checks and report actual results, limitations, and time spent.
5. Stop for user review. The user will commit and push reviewed changes.

Keep a short record of significant agent directions and accepted or challenged
decisions for APPROACH.md. Label exact excerpts versus retrospective summaries.
Record material contract revisions. Do not include private model reasoning.
