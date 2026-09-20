# Logos - Shipping Document Verification

Logos processes a shipping-operations inbox. It classifies every email, and for document-comparison
requests it extracts 7 fields from the Shipping Instruction (SI) and the draft Bill of Lading (BL),
compares them with plain Python (no LLM), and escalates anything uncertain to a human reviewer.
Reviewers can correct extracted values and email categories; every correction is written to an
audit log, and the verdict is recomputed.

The 7 compared fields: shipper, consignee, notify party, port of loading, port of discharge,
container count, gross weight (kg). The SI is the source of truth.

## Setup

### 1. Prerequisites

- **Python 3.10 or newer** (check with `python --version`).
- **Node.js 20.9 or newer** (check with `node --version`) for the web frontend.
- **An Anthropic API key with credits**: create one at https://console.anthropic.com (Settings, API Keys)
  and add credits under Billing. A Claude.ai chat subscription does not work for API calls.
- **The dataset**: an `inbox/` folder (email JSON files) and an `attachments/` folder at the repo root,
  alongside the provided `loader.py`. Logos never generates sample data; if these are missing the
  Inbox stays empty. To read them from elsewhere, set `DATA_SOURCE` (see Configuration).
- Optional: Docker, if you prefer `docker compose`.

### 2. Get the code and install dependencies

```bash
git clone <repo-url>
cd Logos-Averix-x-Monash-Hackathon

# recommended: an isolated environment
python -m venv .venv
source .venv/bin/activate          # Windows PowerShell: .venv\Scripts\Activate.ps1

pip install -r requirements.txt

# frontend dependencies (Next.js); run npm from inside the frontend folder
cd frontend
npm install
cd ..
```

### 3. Add your API key

```bash
cp .env.example .env               # Windows: copy .env.example .env
```

Open `.env` and set the first line to your key, with no quotes or spaces:

```
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxx
```

`.env` is git-ignored. Never put a real key in `.env.example` (that file is committed).

For a cheap first trial, also add these lines to `.env` (details under Configuration):

```
EXTRACT_MODEL=claude-haiku-4-5-20251001
CONSISTENCY_CHECK=false
LIMIT=10
```

### 4. Start both servers (two terminals)

Logos is two programs: a Python API (backend) and a Next.js website (frontend). **Keep two terminal
windows or tabs open**, one for each. The website only shows data while the backend is running.

**Terminal 1, backend** (repo root, virtual environment active):

```bash
python -m uvicorn logos.api:app --port 8000
```

Wait for `Uvicorn running on http://127.0.0.1:8000`.

**Terminal 2, frontend:**

```bash
cd frontend
npm run dev
```

Then open **http://localhost:3000** (the website). The backend on port 8000 has no web page of its own:
opening it shows `{"detail":"Not Found"}`, which is normal. Its interactive API docs are at
http://localhost:8000/docs.

Use `python -m uvicorn` rather than bare `uvicorn`; on Windows the `uvicorn` script is often not on
the PATH. Add `--reload` to the backend command while developing so it restarts when Python files
change. The database (`logos.db`) is created automatically on first start.

**Docker alternative** (after creating `.env`): `docker compose up --build` starts both, then open
http://localhost:3000. The database lives in a Docker volume, and the dataset is read from the image,
so rebuild after changing the data. (Not tested on every platform; if it misbehaves, use the two
terminals above.)

**Production build of the frontend:** `cd frontend && npm run build && npm start`.

### 5. Use it

1. Open http://localhost:3000.
2. Type your name under **Signed in as** (bottom left). It is attached to every edit you make.
3. Click **Run pipeline**. Progress appears next to the button, and a pop-up reports the result.
4. Review results in the Inbox, open comparison emails with **View →**, and clear escalated cases
   under **Needs Review**.

### 6. Verify the setup

```bash
pytest                              # backend: 41 tests, no API key needed
cd frontend && npm test             # frontend: 12 tests
```

If emails all land in **Needs Review** with "API call failed" reasons, open one and read the error:
it is almost always a missing or invalid key, or no API credits. Fix `.env`, restart the backend, then
delete `logos.db` (or call `POST /process?force=true`) so those emails are processed again.

### macOS setup

Works on Intel and Apple Silicon MacBooks. Open the **Terminal** app and run these in order.

```bash
# 1. Command line tools (gives you git). Skip if `git --version` already works.
xcode-select --install

# 2. Python 3.10+ and Node.js. The Python that ships with macOS is too old.
#    Install Homebrew first if needed: https://brew.sh
brew install python@3.12 node

# 3. Get the code
git clone <repo-url>
cd Logos-Averix-x-Monash-Hackathon

# 4. Backend: isolated environment and dependencies
python3 -m venv .venv
source .venv/bin/activate           # your prompt now starts with (.venv)
python3 -m pip install -r requirements.txt

# 5. API key
cp .env.example .env
open -e .env                        # set ANTHROPIC_API_KEY=sk-ant-... and save

# 6. Frontend dependencies
(cd frontend && npm install)

# 7. Start the backend (leave this Terminal tab running)
python3 -m uvicorn logos.api:app --port 8000
```

Open a **second Terminal tab** (`Cmd+T`) for the frontend:

```bash
cd Logos-Averix-x-Monash-Hackathon/frontend
npm run dev
```

Then open http://localhost:3000.

- Use `python3` and `python3 -m pip`; a bare `python` or `pip` often does not exist.
- Run `source .venv/bin/activate` again in every new Terminal tab before starting the backend.
- If Python came from python.org and API calls fail with `CERTIFICATE_VERIFY_FAILED`, run
  `/Applications/Python\ 3.x/Install\ Certificates.command` once, then restart the backend.
- `Ctrl+C` stops a server. Hard-refresh the browser with `Cmd+Shift+R`.
- `.env` is hidden in Finder; press `Cmd+Shift+.` to show it, or use `open -e .env`.

### Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `uvicorn` is not recognised | use `python -m uvicorn ...` |
| `No module named ...` | run `pip install -r requirements.txt` in the active environment |
| The page is stuck on "Loading...", or shows "Internal Server Error" (also when clicking Run pipeline) | the backend is not running on port 8000. Start it in Terminal 1 and refresh. If it is running, check that `API_URL` points to it |
| `{"detail":"Not Found"}` in the browser | you opened the backend (port 8000). Open http://localhost:3000 instead |
| `npm error ENOENT ... package.json` | you ran `npm` from the repo root. Run `cd frontend` first |
| Port 3000 or 8000 already in use | stop the other process, or use `npm run dev -- -p 3001` / `--port 8001` (and set `API_URL` for the frontend) |
| A button or feature does nothing / "Method Not Allowed" | the backend is running old code; restart it (or use `--reload`) and hard-refresh the page (Ctrl+F5) |
| Run processes fewer emails than expected | `LIMIT` is set in `.env`; set it to `0` or remove it |
| Old results after changing models or prompts | previously processed emails are kept; delete `logos.db` and re-run |
| Inbox is empty and Run pipeline does nothing | `inbox/` and `attachments/` are not where `DATA_SOURCE` points |

### Configuration (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | (required) | API key |
| `CLASSIFY_MODEL` | `claude-haiku-4-5-20251001` | model for email classification |
| `EXTRACT_MODEL` | `claude-sonnet-5` | model for field extraction |
| `CONSISTENCY_CHECK` | `true` | extract each document twice and escalate if the passes disagree (doubles extraction cost) |
| `LOW_CONFIDENCE` | `0.7` | classification confidence below this escalates the email |
| `LIMIT` | `0` | only process the first N emails (0 = all); handy for testing |
| `WORKERS` | `6` | parallel emails during a run |
| `DATA_SOURCE` | `.` | folder containing `inbox/` + `attachments/`, or an `http://host:8080` server |
| `DATABASE_URL` | `sqlite:///logos.db` | any SQLAlchemy URL, e.g. `postgresql+psycopg://user:pw@host/logos` |

**Cheapest setup for testing:** `EXTRACT_MODEL=claude-haiku-4-5-20251001`, `CONSISTENCY_CHECK=false`,
`LIMIT=10`.

**Resetting:** stop the server and delete `logos.db` to start from scratch. Alternatively
`POST /process?force=true` reprocesses everything. Both discard prior edits.

## Using the app

- **Inbox**: search, category pills, four stat cards (click one to filter by status), and a scrollable
  table of emails. Each row has a checkbox and a trash icon for deleting (single or batch). Comparison
  emails link to **View →**; every other category links to **Source →**. **Run pipeline** shows live
  progress and has a **Cancel** button (in-flight emails finish first); a pop-up reports the result.
- **Comparison detail**: metadata, a side-by-side SI vs BL table with mismatches highlighted, a verdict
  banner, **Escalate to Team**, **View Source** (raw email body and SI/BL text) and **Mark Resolved**.
  **Download PDF** and **Download Word** export the case as a report (metadata, verdict, comparison
  table, open escalations and edit history). **Previous / Next** steps through the list you came from.
  Click a field name to see the source excerpt it was extracted from. **Edit** on a row corrects the
  SI or BL value (a reason is required). **Wrong? Change** corrects the category. The Edit History
  section lists every correction, or "No edits recorded for this case".
- **Needs Review**: escalated cases with the reason, the source evidence in monospace, and **Change
  Category**, **View Source** and **Confirm & Resolve** actions.
- Other categories (invoice, new SI, general, spam) show the email body only, with no escalate/resolve
  buttons on the detail page.

## Pipeline

1. **Classify** each email as `BL_COMPARISON`, `SI_REQUEST`, `INVOICE_QUERY`, `GENERAL` or `SPAM` (LLM,
   forced tool output). Emails that ask us to *send* a draft BL (no documents supplied) are `GENERAL`;
   only emails that supply an SI and draft BL for checking are `BL_COMPARISON`.
2. **Extract** the 7 fields from each attachment (LLM, fixed JSON schema). Label variants
   ("Load Port", "POL", "To the Order of", ...) are normalized in the prompt from `fields.py`. Text
   attachments are read directly; PDF, DOCX and XLSX are converted to text first.
3. **Compare** with deterministic Python: case and whitespace normalized for text, exact match for numbers.
4. **Escalate** to `NEEDS_REVIEW` with a reason and source evidence, never guessing:

| Reason | Trigger |
|---|---|
| `low_confidence` | classification confidence below `LOW_CONFIDENCE` |
| `missing_attachment` | comparison email without an SI or BL file |
| `unreadable` | attachment has no extractable text (e.g. scanned PDF) or cannot be opened |
| `wrong_doc_type` | the LLM judges the attachment is not an SI/BL as named |
| `missing_value` | a required field is absent or illegible in a document |
| `retry_disagreement` | a second extraction pass disagrees on a field |
| `llm_error` | the LLM call fails or returns malformed JSON twice (one retry, then escalate) |
| `manual_escalation` | a reviewer pressed **Escalate to Team** |

5. **Human correction with audit log**: field edits and category changes are stored in `edit_log`
   (field, old value, new value, editor, timestamp, reason). After an edit the verdict is recomputed.
   A case cannot be resolved while any of the 7 fields is still missing.

### Category changes

Changing a category to `BL_COMPARISON` runs extraction immediately (a few seconds and API credits).
Changing away from it discards the extracted SI/BL data and open escalations. Any change clears the
resolved marker. Resolving or re-categorising a case also clears the Inbox filters so the case is visible.

## Architecture

```
logos/
  config.py      settings from environment / .env
  fields.py      the 7 fields and label aliases
  documents.py   txt / pdf / docx / xlsx attachment -> text (scanned PDFs are sent to the model as PDFs)
  llm.py         Anthropic tool-use calls, validation, one retry then LLMError
  compare.py     deterministic diff and verdict
  escalation.py  escalation reasons (code, message, evidence)
  pipeline.py    classify -> extract -> compare -> escalate for one email
  reports/       downloadable case reports: model.py (content), pdf.py, word.py, FORMATS registry
  service.py     storage operations: edits + audit log, category, escalate, resolve, delete, queries
  db.py          SQLAlchemy Core tables (emails, edit_log)
  api.py         FastAPI endpoints and background run (API only, no web pages)
frontend/        Next.js 16 + React 19 + TypeScript + Tailwind v4; the browser calls /api/*,
                 which Next.js proxies to the backend (no CORS)
  src/app/         routes: /, /review, /emails/[id]
  src/components/  ui, layout, inbox, case, review
  src/hooks/ src/providers/ src/lib/   data hooks, shared state, api client and helpers
tests/           pytest suite
loader.py        provided dataset loader (Inbox)
```

## API

| Endpoint | Purpose |
|---|---|
| `GET /emails?category=&status=&q=` | list emails |
| `GET /emails/{id}` | detail: comparison rows, escalations, evidence, edit log |
| `GET /emails/{id}/source` | email body and raw SI/BL text |
| `GET /emails/{id}/report?format=pdf\|docx` | download the comparison report (comparison emails only) |
| `POST /emails/{id}/edit` | `{doc: SI\|BL, field, new_value, editor, reason}` |
| `POST /emails/{id}/category` | `{category, editor, reason}` |
| `POST /emails/{id}/escalate`, `/resolve` | `{editor, note}` |
| `DELETE /emails/{id}`, `POST /emails/batch-delete` | delete one / `{ids: [...]}` (also removes edit history) |
| `GET /review-queue` | escalated cases with reason and evidence |
| `POST /process[?force=true]`, `POST /process/cancel`, `GET /process/status` | run, cancel, poll |
| `GET /stats` | dashboard counts |

Interactive API docs are at http://localhost:8000/docs.

## Tests

```bash
pytest
```

41 backend tests (plus 12 frontend tests, `cd frontend && npm test`) cover label normalization, the comparison diff, each escalation trigger, malformed-LLM retry,
edit and audit-log behaviour with verdict recompute, category changes, deletion, and PDF/Word report generation. The LLM is stubbed,
so no API key is needed.  Prompt wording changes (such as the classification rules) are not covered by
the tests and should be checked with a real run.

## Code principles

- **Deterministic where it matters.** The LLM only classifies and extracts. The verdict, escalation
  rules and audit log are plain, unit-tested Python, so the same inputs always give the same result.
- **Never fail silently, never guess.** Every LLM failure, unreadable file, missing value or model
  disagreement becomes an escalation with a reason and source evidence. Malformed model output is
  retried once, then escalated; one bad email cannot crash a run.
- **Validate at the boundaries.** LLM output is checked against a fixed schema; API inputs are
  validated (required editor and reason, numeric formats, known fields and categories) and return clear
  HTTP errors.
- **Separation of concerns.** Pipeline (`pipeline.py`), pure logic (`compare.py`, `fields.py`,
  `escalation.py`), storage operations (`service.py`), persistence (`db.py`) and HTTP (`api.py`) are
  separate modules; the frontend only calls the API.
- **Auditability.** Every human correction (field or category) is recorded with editor, timestamp,
  old and new value, and reason, and is shown per case.
- **Portable storage.** SQLAlchemy Core with portable column types; changing `DATABASE_URL` is all it
  takes to move to Postgres.
- **Testable by design.** The LLM layer is injectable and stubbed in tests, so the suite runs offline.
- **Secure by default.** Secrets come from the environment and are git-ignored; all frontend output is
  HTML-escaped; database access uses parameterised queries.
- **Small and dependency-light.** No orchestration framework on the backend.

Known limits: the reviewer name is not authenticated, `requirements.txt` is not version-pinned, and
there is no linter configuration in the repo (the code was checked with `pyflakes`).

## Decisions worth knowing

- Shipper, consignee and notify party are compared on the **name only**; addresses are stripped at
  extraction, so an address-only discrepancy is not flagged.
- Email records carry no timestamp, so the UI's time column shows when Logos processed the email.
- Field excerpts show what the model originally extracted; they do not change when a reviewer edits a value.
- The reviewer name is a plain text input standing in for auth; nothing verifies it.
- Prompt rules: emails asking for or delivering a new SI are `SI_REQUEST` ("New SI"); emails asking us to send a draft BL are `GENERAL`.
- Deleted emails are re-processed the next time the pipeline runs.
- The hackathon scoring uses five fixed categories, so no extra category (such as "Action item") was added.
