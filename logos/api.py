import logging
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from . import config, reports, service
from .escalation import reason
from .pipeline import now, process_email

sys.path.insert(0, str(config.ROOT))
from loader import Inbox  # noqa: E402

log = logging.getLogger("logos.api")
app = FastAPI(title="Logos")

progress = {"running": False, "cancelled": False, "done": 0, "total": 0, "errors": 0,
            "started_at": None, "finished_at": None}
_lock = threading.Lock()
cancel_event = threading.Event()


class EditIn(BaseModel):
    field: str
    doc: str
    new_value: str
    editor: str
    reason: str


class ActorIn(BaseModel):
    editor: str
    note: str = ""


@app.exception_handler(service.ServiceError)
def _service_error(_, exc: service.ServiceError):
    return JSONResponse(status_code=exc.status, content={"detail": exc.message})


def _safe_process(email, inbox):
    try:
        return process_email(email, inbox)
    except Exception as e:  # never crash the run; park the email for a human
        log.exception("pipeline failed for %s", email.get("email_id"))
        with _lock:
            progress["errors"] += 1
        return {
            "id": email["email_id"], "sender": email.get("from"), "subject": email.get("subject"),
            "body": email.get("body"), "attachments": email.get("attachments") or [],
            "category": "UNKNOWN", "confidence": None, "rationale": None, "shipment_ref": None,
            "status": "NEEDS_REVIEW", "processed_at": now(), "si_fields": None, "bl_fields": None,
            "si_evidence": None, "bl_evidence": None, "si_text": None, "bl_text": None,
            "reasons": [reason("llm_error", f"Unexpected pipeline error: {e}",
                               f"Subject: {email.get('subject')}")],
            "resolved_by": None, "resolved_at": None, "escalated_by": None,
        }


def run_pipeline(force: bool):
    try:
        inbox = Inbox(config.DATA_SOURCE)
        emails = inbox.emails()
        if config.LIMIT:
            emails = emails[:config.LIMIT]
        if not force:
            done = service.processed_ids()
            emails = [e for e in emails if e["email_id"] not in done]
        progress.update(total=len(emails), done=0, errors=0)

        def work(e):
            if cancel_event.is_set():
                return
            service.save_row(_safe_process(e, inbox))
            with _lock:
                progress["done"] += 1

        with ThreadPoolExecutor(max_workers=config.WORKERS) as ex:
            list(ex.map(work, emails))
    finally:
        progress.update(running=False, finished_at=now(), cancelled=cancel_event.is_set())


@app.post("/process", status_code=202)
def process(force: bool = False):
    with _lock:
        if progress["running"]:
            raise HTTPException(409, "A processing run is already in progress")
        cancel_event.clear()
        progress.update(running=True, cancelled=False, started_at=now(), finished_at=None)
    threading.Thread(target=run_pipeline, args=(force,), daemon=True).start()
    return progress


@app.post("/process/cancel")
def cancel_process():
    if not progress["running"]:
        raise HTTPException(409, "No processing run is in progress")
    cancel_event.set()
    return progress


@app.get("/process/status")
def process_status():
    return progress


@app.get("/emails")
def list_emails(category: Optional[str] = None, status: Optional[str] = None, q: Optional[str] = None,
                archived: bool = False):
    return service.list_emails(category, status, q, archived)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/stats")
def stats():
    return service.stats()


@app.get("/emails/{email_id}")
def get_email(email_id: str):
    return service.detail(email_id)


@app.get("/emails/{email_id}/report")
def get_report(email_id: str, format: str = "pdf"):
    fmt = reports.FORMATS.get(format)
    if fmt is None:
        raise service.ServiceError(400, f"format must be one of: {', '.join(reports.FORMATS)}")
    detail = service.detail(email_id)
    if detail["category"] != "BL_COMPARISON":
        raise service.ServiceError(400, "Reports are only available for document-comparison emails")
    content = fmt.render(reports.build_report(detail))
    return Response(content, media_type=fmt.mime, headers={
        "Content-Disposition": f'attachment; filename="logos-{email_id}.{fmt.extension}"'})


@app.get("/emails/{email_id}/source")
def get_source(email_id: str):
    return service.source(email_id)


class IdsIn(BaseModel):
    ids: list[str]


@app.post("/emails/archive")
def archive_emails(body: IdsIn):
    return service.set_archived(body.ids, True)


@app.post("/emails/unarchive")
def unarchive_emails(body: IdsIn):
    return service.set_archived(body.ids, False)


@app.post("/emails/{email_id}/edit")
def edit(email_id: str, body: EditIn):
    return service.apply_edit(email_id, body.doc, body.field, body.new_value, body.editor, body.reason)


class CategoryIn(BaseModel):
    category: str
    editor: str
    reason: str


@app.post("/emails/{email_id}/category")
def change_category(email_id: str, body: CategoryIn):
    inbox = Inbox(config.DATA_SOURCE)
    return service.change_category(
        email_id, body.category, body.editor, body.reason,
        lambda e, cat: process_email(e, inbox, forced_category=cat))


@app.post("/emails/{email_id}/escalate")
def escalate(email_id: str, body: ActorIn):
    return service.escalate(email_id, body.editor, body.note)


@app.post("/emails/{email_id}/resolve")
def resolve(email_id: str, body: ActorIn):
    return service.resolve(email_id, body.editor)


@app.get("/review-queue")
def review_queue():
    return service.review_queue()
