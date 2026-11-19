# Hotel recommendations fixture demo

A local Serko take-home application: enter a hotel request, review synthetic
recommendations, and select one hotel. Built with React, Next.js App Router,
TypeScript, Tailwind CSS, and a small Python FastAPI API.

No API key is needed. There is no natural-language interpretation, live model,
streaming, scraping, real booking, authentication, database, or deployment.

## Versions

Versions observed in the development environment:

| Tool/package | Version |
| --- | --- |
| Node.js | 22.22.2 |
| npm | 10.9.7 |
| Python | 3.12.8 |
| Next.js | 16.4.6 |
| React / React DOM | 19.3.1 |
| TypeScript | 7.0.2 |
| Tailwind CSS / PostCSS plugin | 4.3.5 |
| Vitest | 5.1.0 |
| Testing Library React | 16.3.3 |
| FastAPI | 0.163.0 |
| Uvicorn | 0.54.0 |
| Pydantic | 2.14.3 |
| pytest | 9.2.0 |

`frontend/package-lock.json` and `backend/requirements.txt` record dependencies.
Commands assume a POSIX shell and that `python3` selects the intended Python
version. Run all commands from the repository root.

## Install and configure

```sh
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
npm --prefix frontend ci
# Preserve an existing local configuration:
test -f frontend/.env.local || cp frontend/.env.example frontend/.env.local
```

The committed safe example contains only:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

The URL is public browser configuration. Never put credentials in a
`NEXT_PUBLIC_` variable. Real environment files, dependencies, caches, and build
output are ignored by Git. Restart Next.js after changing `.env.local`; rebuild
if using a production build.

## Run locally

Terminal 1:

```sh
backend/.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Terminal 2:

```sh
npm --prefix frontend run dev
```

Open the **Local** URL printed by Next.js. Development starts at port 3000 by
default and tries subsequent ports if needed. To choose a specific port, run
`npm --prefix frontend run dev -- --port 3100`. Keep the `localhost` hostname
so the browser origin matches the API's CORS policy. The API base URL is
`http://localhost:8000`. Stop each service with Ctrl+C.

Optional production frontend commands, with FastAPI still running:

```sh
npm --prefix frontend run build
npm --prefix frontend start
```

The production preview asks the OS for a free port and prints its **Local** URL.
To use a specific port, run `npm --prefix frontend start -- --port 3100`.

The production build was checked; running the production server was not checked.

## Fixture demo and reproduction steps

**Demo scenario** is a deterministic control, defaulting to Success. It chooses
the response independently of the traveller's wording. Responses, recommendations,
and selection are labelled synthetic fixture data.

### Success and selection

1. Enter: `Find a Wellington hotel for two nights, up to NZD 250 per night; breakfast preferred.`
2. Leave **Success** selected and click **Find hotels**.
3. Expect visible progress and disabled submission during the approximately
   700 ms asynchronous success delay.
4. Expect the assistant message and all three fixtures below, with explanations.
5. Use a **Select [hotel name]** button. The summary shows that hotel's name,
   nightly price, currency, and breakfast information. Only one hotel is selected.
6. Submit again: previous cards and selection clear when the request starts.

| ID | Name | Nightly price | Currency | Breakfast included | Explanation |
| --- | --- | --- | --- | --- | --- |
| h1 | Harbour House | 220 | NZD | Yes | Within budget; breakfast included. |
| h2 | City Garden | 245 | NZD | Yes | Near the meeting district. |
| h3 | Quay Rooms | 195 | NZD | No | Lower price; breakfast costs extra. |

### Empty

Select **Empty**, enter a nonblank message, and submit. Expect HTTP 200, a fixture
assistant message, a clear no-hotels state, and no cards. Switch to Success and
submit to obtain recommendations.

### HTTP 503 and manual recovery

1. Enter a nonblank message, select **Error**, and submit.
2. Expect HTTP 503 and the readable error detail; the input remains visible.
3. Switch **Demo scenario** to **Success** and click **Retry** directly.
4. Expect a request with the original submitted message and `scenario: "success"`,
   followed by the assistant message and all three cards.

Retry uses the **last submitted message**, even if the visible draft is edited
after failure, and the **currently selected scenario**. Keeping Error selected
continues to return 503. There are no automatic retries. Network failures also
show an error with manual retry.

## API contract and checks

The handwritten contract is [openapi.yaml](openapi.yaml), drafted and committed
before backend implementation. `POST /recommendations` requires a string message
containing a non-whitespace character and a scenario of `success`, `empty`, or
`error`. Invalid requests return 422; demo failures return 503 with a string
`detail`. Hotel fields are `id`, `name`, `nightlyPrice`, `currency`,
`breakfastIncluded`, and `explanation`.

```sh
backend/.venv/bin/python -m pytest backend/tests -q
npm --prefix frontend test
npm --prefix frontend run typecheck
npm --prefix frontend run build
# Requires the running FastAPI server:
backend/.venv/bin/python backend/check_http.py
```

The HTTP script checks success, invalid input, and error against the handwritten
contract. API tests also cover empty results and CORS. Frontend tests mock fetch.
There is no configured lint command. See [APPROACH.md](APPROACH.md) for actual
results, evidence boundaries, browser limitations, and outstanding checks.

Recorded automated results: **18 backend tests passed, 8 frontend tests passed,
and the production build passed**. No application tests were rerun for the
documentation-only changes.

The user manually verified Chrome with both local services running: Success
returned 200 and all three hotels; selecting City Garden showed NZD 245.00 per
night and breakfast included. Empty returned 200, showed “No hotels found”, and
cleared cards and selection. Error returned 503 with readable feedback and retained
input; switching to Success and clicking Retry returned 200 and all three cards.
DevTools confirmed the original message and `scenario: "success"` in that retry.
At a 375 px viewport, the user observed no horizontal scrolling and visible focus,
and submitted, selected a hotel, and activated Retry by keyboard.

These are user-reported manual observations. Codex browser automation timed out;
frontend component tests separately mock fetch. The generated `frontend/AGENTS.md`
is ignored and excluded from the submission; root `AGENTS.md` is the project context.

## Branch and version reference

- Submission branch: `main`.
- Application/API version: `0.1.0`.
- Implementation commit: `ef8c300c894b38d3c4a5359ae9d1762dc4fb1404`
  (`feat: display hotel cards and selection summary`).
- The exact submission commit is identified in the delivery message.

After committing the reviewed files, identify the exact submitted branch and
commit in the delivery message:

```sh
git branch --show-current
git rev-parse HEAD
```
