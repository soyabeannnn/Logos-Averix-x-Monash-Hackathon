# Logos - Shipping Document Verification

Processes a shipping-operations inbox: classifies each email, and for document-comparison
requests extracts 7 fields from the Shipping Instruction (SI) and the draft Bill of Lading (BL),
diffs them deterministically, and escalates anything uncertain to a human. Reviewers can correct
any extracted value; every correction is written to an audit log and the verdict is recomputed.

## Run it

```bash
cp .env.example .env          # add ANTHROPIC_API_KEY
# Option A: Docker
docker compose up --build
# Option B: local
pip install -r requirements.txt
uvicorn logos.api:app --port 8000
```

Open http://localhost:8000, enter your name under "Signed in as", and choose **Run pipeline**
(or `curl -X POST localhost:8000/process`). Progress shows live; re-running skips emails already
processed (`/process?force=true` reprocesses everything and discards prior edits).

The dataset is read through `loader.Inbox`. It expects `inbox/` and `attachments/` at the repo root
(`DATA_SOURCE=.`); set `DATA_SOURCE` to another folder or `http://host:8080` to change that.

## Tests

```bash
pytest
```

27 tests covering label normalization, the comparison diff, every escalation trigger, malformed-LLM
retry, and the edit/audit-log/verdict-recompute flow. The LLM is stubbed, so no API key is needed.

## Architecture

```
logos/
  fields.py      7 fields + label aliases (aliases are injected into the extraction prompt)
  documents.py   txt / pdf / docx / xlsx attachment -> text
  llm.py         Anthropic tool-use calls (forced JSON schema), validation, one retry then LLMError
  compare.py     deterministic diff (no LLM): case/whitespace-normalized text, exact numbers
  escalation.py  escalation reasons: code + message + source evidence
  pipeline.py    classify -> extract (twice) -> compare -> escalate, one email -> one row
  service.py     storage operations: edit + audit log, escalate, resolve, queries
  db.py          SQLAlchemy Core tables (emails, edit_log); DATABASE_URL swaps SQLite for Postgres
  api.py         FastAPI endpoints + static frontend
frontend/        plain HTML/CSS/JS
```

**Models.** Classification uses Claude Haiku 4.5 and extraction uses Claude Sonnet 5 (both overridable
in `.env`). Both use forced tool calls with a fixed schema. The comparison itself never touches an LLM.

**Escalation** (status `NEEDS_REVIEW`, with reason + evidence stored on the case):

| Reason | Trigger |
|---|---|
| `low_confidence` | classification confidence < `LOW_CONFIDENCE` (0.7) |
| `missing_attachment` | comparison email without an SI or BL file |
| `unreadable` | attachment has no extractable text (e.g. scanned PDF) or cannot be opened |
| `wrong_doc_type` | the LLM judges the attachment is neither an SI nor a BL as named |
| `missing_value` | a required field is null/absent in a document |
| `retry_disagreement` | a second independent extraction pass disagrees on a field |
| `llm_error` | LLM call fails or returns malformed JSON twice (one retry, then escalate) |
| `manual_escalation` | reviewer pressed "Escalate to Team" |

A case cannot be resolved while any of the 7 fields is still missing; use Edit to fill it in first.

## API

| Endpoint | Purpose |
|---|---|
| `GET /emails?category=&status=&q=` | list emails with classification/status |
| `GET /emails/{id}` | detail: comparison rows, open escalations, edit log |
| `GET /emails/{id}/source` | email body and raw SI/BL text |
| `POST /emails/{id}/edit` | `{doc: SI\|BL, field, new_value, editor, reason}`; logs and recomputes verdict |
| `POST /emails/{id}/escalate`, `/resolve` | `{editor, note}` |
| `GET /review-queue` | escalated cases with reason + evidence |
| `POST /process`, `GET /process/status` | run the pipeline in the background / poll progress |
| `GET /stats` | dashboard counts |

## Decisions worth knowing

- Party fields (shipper, consignee, notify party) are compared on the **name only**; addresses are
  stripped at extraction. An address-only discrepancy will not be flagged.
- The email records carry no timestamp, so the UI's time column shows when Logos processed the email.
- The extraction consistency pass doubles extraction calls; set `CONSISTENCY_CHECK=false` to halve cost.
- Non-comparison emails escalated for low confidence can be confirmed but not re-categorised.
- The reviewer name is a plain text input standing in for auth; nothing verifies it.
