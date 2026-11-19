# Approach and evidence

## Scope and assumptions

The agreed outcome is one local journey: ask for a hotel, review three synthetic
recommendations, and select one. The implementation uses a single Next.js App
Router page and one FastAPI endpoint, including loading, empty results,
recoverable failure, client/server message validation, and a selection summary.

The message is accepted as text, not interpreted. Scenario is a visible demo
control; Success always returns all supplied fixtures regardless of wording.
No external model, booking service, persistence, authentication, or deployment
was added. Two local processes and the documented ports are assumed.

## Decisions and trade-offs

- Local fixtures and approximately 700 ms `asyncio.sleep` for Success provide
  deterministic evidence and visible loading without an external dependency.
- The browser calls FastAPI directly using `NEXT_PUBLIC_API_BASE_URL`. Avoiding
  an extra proxy keeps the implementation small but requires CORS and correct
  local origins. Only `http://localhost:3000` is allowed for frontend POST requests.
- FastAPI/Pydantic return HTTP 422 for missing fields, wrong types, blank messages,
  invalid scenarios, and malformed JSON. HTTP 503 has a readable string `detail`;
  the frontend handles non-string error details with a fallback.
- Manual Retry uses the last submitted message and current scenario. The user
  challenged the initial same-scenario retry proposal to enable direct recovery
  by switching Error to Success. Error stays deterministic: no hidden fail-once
  state or automatic retry. Edited drafts remain visible but are not submitted by
  Retry; the UI explains the rule.
- Previous results and selection clear when a request starts, avoiding stale
  choices. A pending ref guards duplicate requests.
- Native buttons with `aria-pressed` represent one selection. A polite live region
  announces the summary. Focus styling is defined; cards stack on narrow screens
  and use two columns at the configured small breakpoint. The user manually
  verified visible focus and no horizontal scrolling at a 375 px Chrome viewport.
- Focused component/API checks provide bounded coverage within the cap; they do
  not replace real-browser verification.

## Contract-first history and revisions

`openapi.yaml` was handwritten in commit `6b76f00` before backend implementation
in `84b656c`. It documents required fields, fixtures, success/empty examples,
422 errors, a 503 string detail, fixture labels, and the success delay.
`git log -- openapi.yaml` and comparison with its initial commit show **no
subsequent material contract revisions**. The retry decision changed frontend
behaviour before implementation, not the HTTP contract.

API tests and the HTTP script check response schemas/examples against this file.
A full standalone OpenAPI document validator was not run; generated runtime docs
are not the contract-first evidence.

## Actual verification results

Automated results below were recorded for implementation commit `ef8c300`.
User-reported manual Chrome observations are listed separately. Documentation-only
changes follow that implementation; no application tests were rerun for these
documentation-only changes. Commands were run from the repository root.

| Layer | Command / evidence | Observed result |
| --- | --- | --- |
| API tests, in process | `backend/.venv/bin/python -m pytest backend/tests -q` | 18 passed: exact fixtures with two valid phrasings, delay, empty, repeatable 503, required fields, blank/Unicode whitespace, types, scenarios, malformed JSON, and CORS. |
| Mocked frontend tests | `npm --prefix frontend test` | 8 passed: validation, pending progress/duplicate prevention, URL/body, empty, 503 recovery, repeated Error, network failure, cards, keyboard selection, summary, and selection reset. |
| TypeScript | `npm --prefix frontend run typecheck` | Passed during frontend implementation; later build also passed its TypeScript step. |
| Production build | `npm --prefix frontend run build` | Passed; `/` and `/_not-found` generated. Production server runtime not tested. |
| Real API HTTP | `backend/.venv/bin/python backend/check_http.py` with Uvicorn running | Success 200 in 0.712 s with exact fixtures; whitespace message 422 with contract-valid structure; Error 503 with exact documented detail. |
| Additional real HTTP | curl POST `{"message":"Hotel please","scenario":"empty"}` to `http://localhost:8000/recommendations` | 200; saved JSON compared exactly with the Empty contract example using Ruby. |
| Real CORS preflight | curl OPTIONS with Origin `http://localhost:3000`, requested POST and Content-Type | 200 with the expected `access-control-allow-origin` header. |
| Real frontend HTTP | curl GET `http://localhost:3000` | 200; HTML contained both field labels, submit button, and fixture label. Does not prove hydration or interaction. |
| Codex browser automation | Browser inventory, then two native Chrome access attempts | **Not run**: browser access host unavailable; both native attempts timed out. This does not negate the user's separate manual Chrome checks below. |
| User manual Chrome: success/selection | Both local services running | 200, all three fixture hotels displayed; City Garden summary showed NZD 245.00 per night and breakfast included. |
| User manual Chrome: Empty | Both local services running | 200, “No hotels found”; previous cards and selection summary cleared. |
| User manual Chrome: 503/retry | Chrome UI and DevTools | Error returned 503, readable error and preserved input; switching to Success and Retry sent original message with scenario success, returned 200, and restored all three cards. |
| User manual Chrome: narrow screen/keyboard | 375 px viewport | No horizontal scrolling; visible focus; form submission, hotel selection, and Retry worked by keyboard. |
| Git checks | `git diff --check`; `git diff --exit-code -- openapi.yaml` | Passed at verification. |

Both services ran using the README commands:

```sh
backend/.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
npm --prefix frontend run dev
```

They were stopped after checks. The execution sandbox initially blocked package
downloads, server binding, and localhost HTTP. Permission-based retries completed
setup and HTTP checks; these were environment restrictions rather than application
defects.

During initial frontend verification, TypeScript rejected an obsolete Vitest
`esbuild.jsx` option. Removing it and marking the package as an ES module fixed the
configuration; tests, type checking, and build were rerun successfully. No
application defects were reproduced in the later verification stage. API tests
still emit an upstream Starlette warning about deprecated `httpx` integration;
the warning is disclosed rather than suppressed.

## Main journey and recovery evidence

`frontend/test/page.test.tsx` renders the actual page while replacing fetch. It
checks all three cards and required fields. Tab/Enter selects Harbour House;
Tab/Space selects Quay Rooms; summary contents and pressed states reflect one
selection. A controlled pending promise checks that old cards/selection disappear
when a new request starts and selection stays cleared when fixtures return.

The recovery test submits the original message with Error, observes the 503 detail
and preserved input, edits the visible draft, switches to Success, and clicks
Retry. It checks the second request body exactly:

```tsx
expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).toEqual({ message: originalMessage, scenario: "success" });
expect(await screen.findByText(success.message)).toBeVisible();
expect(screen.getAllByRole("article")).toHaveLength(3);
```

It also checks each hotel card by name. These assertions are component evidence.
Real HTTP checks independently confirm API success and 503 responses. Separately,
the user reported the following manual Chrome evidence with local Next.js and
FastAPI running:

- Success: POST `/recommendations` returned 200 and displayed all three hotels.
  Selecting City Garden showed NZD 245.00 per night and breakfast included.
- Empty: HTTP 200, “No hotels found”, and no previous cards or selection summary.
- Recovery: Error returned 503 with readable feedback and preserved input. After
  switching to Success and clicking Retry, DevTools showed the original message
  and `scenario: "success"`; the response was 200 and all three cards reappeared.

These observations establish the manually checked main journey and recovery,
separately from mocked tests and Codex automation. Manual evidence is recorded as
Chrome and DevTools observations.

## Mock boundaries and manual checks

- Frontend: Vitest, Testing Library, user-event, and jsdom exercise the real page
  and state transitions. Fetch is stubbed. Networking, browser CORS enforcement,
  layout, hydration, and actual focus-ring rendering are outside these tests.
- API: TestClient exercises the real handler, validation, delay, and models in
  process without a live socket. Tests load the handwritten response schemas and
  examples; local fixture data is the intended backend data source.
- HTTP: the script/curl use real sockets with both services running. These checks
  confirm server responses, not browser integration.
- User manual keyboard check: **Passed, user-reported in Chrome**. Focus was
  visible; form submission, hotel selection, and Retry worked by keyboard.
  This is separate from automated jsdom Tab/Enter/Space checks. A screen-reader
  audit and exhaustive keyboard coverage were not reported.
- User manual small-screen check: **Passed, user-reported at 375 px**. The layout
  required no horizontal scrolling. Touch use and other viewport/browser
  combinations were not reported.
- Codex browser automation: **Not run** after connection/tool timeouts. The
  successful manual observations were made by the user, not by Codex automation.

## Agent context and representative interactions

**Request reliability follow-up (retrospective summary).** The user requested
a timeout and runtime validation of successful frontend responses. The browser
aborts the request after five seconds, including time spent reading the body.
It checks the required response and hotel fields against the OpenAPI types
before rendering. Both failures use the existing manual Retry flow. The HTTP
contract remains unchanged. Frontend regression tests mock fetch, including
aborts during response retrieval and body reading.

**Follow-up refactor (retrospective summary).** The user asked to split
`page.tsx` into components. The page retains request state, submission and
retry logic. `HotelRequestForm`, `RecommendationResults` and `HotelCard`
render the corresponding parts of the existing UI. The API contract was
unchanged. The existing frontend suite mocks fetch and covers recovery from
HTTP 503, including the retry payload and all three returned cards.

The record shows the agent explicitly reading root `AGENTS.md` and `openapi.yaml`
before implementation. The backend tool call included
`cat AGENTS.md; cat openapi.yaml`, followed by this acknowledgement:

**Exact excerpt — agent:** “I’ve loaded `AGENTS.md` and `openapi.yaml`; I’ll keep
the contract unchanged.”

This demonstrates explicit file use during implementation.

**Retrospective summary — user-reported fresh-session evidence:** The user started
a fresh Codex CLI session from the repository root. In its first message, the user
asked it to summarize project instructions already available before opening any
repository files or running commands. It identified `openapi.yaml` as the API
contract and restated Retry as reusing the last submitted message with the current
scenario. It reported that it had not opened files or run commands. This is
observable evidence that repository-specific AGENTS.md instructions were available
in the fresh session, rather than supplied by a later file-reading command. It is
recorded as the user's observation, not a verbatim CLI transcript or a new test
performed during documentation editing.

Next.js generated `frontend/AGENTS.md` during dev startup. That generated file is
ignored and excluded from the submission; root `AGENTS.md` remains the submitted
project context file.

Three real interactions shaped the result:

1. **Exact excerpt — user:** “Retry should resend the last submitted message
   with the currently selected demo scenario.”

   **Retrospective summary:** The user accepted the deterministic backend but
   challenged the initial same-scenario retry proposal to allow direct recovery.
   The agent accepted the correction. Implementation and tests preserve the
   original submitted message while reading the current scenario, even after
   the visible draft changes. The recovery component test asserts that request
   body, and the user independently confirmed it in Chrome DevTools after Error
   → Success → Retry, followed by HTTP 200 and all three hotel cards.

2. **Exact excerpt — user:** “This stage is for the handwritten API contract and
   repository context.”

   **Retrospective summary:** The user accepted the minimal architecture but
   required contract-first work and review before implementation. The agent
   created the static contract/context first, then implemented against them.
   Git history and contract-based tests show the order and unchanged contract.

3. **Exact excerpt — user:** “Distinguish mocked component tests, API tests,
   real HTTP checks, and browser observations. Mark checks you could not run
   as Not run.”

   **Retrospective summary:** The user required clear evidence boundaries,
   challenging any inference that mocks establish the real journey. The agent
   ran tests/HTTP checks, attempted browser access, and reported its automation
   as Not run after tool failures. The user then supplied separate manual Chrome
   results, now attributed accordingly. This affected evidence reporting, not scope.

## Documentation review and submission hygiene

Runtime versions, package scripts, API code, fixtures, tests, environment example,
ignore rules, and Git history were checked against the documentation. `pip check`
reported no broken requirements. `npm ls --depth=0` confirmed declared versions
and listed two extraneous local packages (`@emnapi/runtime` and
`@img/sharp-wasm32`); these are ignored dependencies, not submitted source.
A separate clean install has not been verified.

The documentation-stage consistency check passed for documented dependency
versions, package scripts, paths, local Markdown links, fixture names, the safe
environment example, and Git references. `git diff --check` passed and
`git diff --exit-code -- openapi.yaml` confirmed no contract changes. Git ignore
checks confirmed local environment, node_modules, build, and virtual-environment
files remain excluded. Application tests were not rerun for documentation-only
changes; their recorded results above are from the preceding verification stage.

A prior heuristic scan covered 23 tracked/proposed files, including the lockfile and
generated frontend context file. It checked credential patterns, private keys,
personal paths/contact details, and confidential-material markers. It found no
likely credential or personal-data matches. Its sole marker match was the benign
instruction in root AGENTS.md to keep confidential material out of records. Manual
source/document review found no confidential source content. No real environment
file or dependency/build directory was in the submission candidate list. The safe
environment example contains only a localhost URL.

After incorporating the user's observations, documentation consistency and
privacy-pattern checks passed again across 22 submission candidates. The generated
`frontend/AGENTS.md` is now excluded by `.gitignore`, while root `AGENTS.md` and the
safe environment example remain included. Checks found no unresolved notes
placeholders or stale missing-observation claims. The delivery message identifies
the exact submission commit and records the total elapsed time through final push.

No credential is needed. Do not submit local tool logs, raw conversation exports,
browser profiles, or Git metadata as evidence. Pattern scans are heuristic and
cannot prove the absence of every sensitive value.

## Limitations and next steps

1. Codex browser automation remains unavailable. Manual Chrome checks cover the
   reported journeys, 375 px layout, and keyboard actions; other browsers,
   screen readers, touch behaviour, and an exhaustive accessibility audit are
   unverified. Loading was checked with a controlled pending component response;
   no separate manual timing/duplicate-click observation was supplied.
2. Verify a clean install and address the upstream test-client warning if time
   permits. No lint command or full accessibility audit is claimed. Production
   hardening remains out of scope.
3. Review/commit/push through the recruitment delivery route and identify the final
   branch/commit in the delivery message. README identifies the current actual
   implementation reference rather than a future documentation hash.

## Time spent

The cap is four hours, including planning, setup, agent waits, implementation,
checks, Git operations, and write-up. The user's time log (NZDT):

| Time | Milestone |
| --- | --- |
| 11:00 am NZDT | Started the assignment, including project setup. |
| 11:25 am NZDT | Pushed the first GitHub commit with handwritten OpenAPI contract and AGENTS.md, before implementing the backend. |
| Around 12:36 pm NZDT | Documentation drafting in progress; approximately 1 hour 36 minutes elapsed at this documentation checkpoint. |
| 12:55 pm NZDT | Final documentation review checkpoint. 1 hour 55 minutes had elapsed since starting at 11:00 am NZDT. |

**Approximately 1 hour 36 minutes is the elapsed time at the 12:36 pm documentation
checkpoint. 1 hour 55 minutes is the elapsed time through the 12:55 pm final
documentation review checkpoint, not the final total.** The total through the
final push will be recorded in the delivery message. Stop at the four-hour cap
even if work remains. No more detailed per-task timing is inferred from Git
timestamps or test durations.
