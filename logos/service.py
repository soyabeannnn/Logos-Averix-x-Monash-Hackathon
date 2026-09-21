"""Storage-backed operations: save, edit (with audit log), escalate, resolve, queries."""
import sqlalchemy as sa

from . import db
from .compare import compare, missing_fields, verdict
from .escalation import reason
from .fields import FIELDS, NUMERIC_FIELDS
from .pipeline import now

DOCS = ("SI", "BL")
CLEARED_ON_EDIT = {"missing_value", "retry_disagreement"}


class ServiceError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status, self.message = status, message


def save_row(row):
    """Insert or replace a processed email. Reprocessing keeps the email archived if it was."""
    eng = db.get_engine()
    with eng.begin() as c:
        archived_at = c.execute(
            sa.select(db.emails.c.archived_at).where(db.emails.c.id == row["id"])).scalar()
        c.execute(sa.delete(db.emails).where(db.emails.c.id == row["id"]))
        c.execute(sa.delete(db.edit_log).where(db.edit_log.c.email_id == row["id"]))
        c.execute(sa.insert(db.emails).values(**{**row, "archived_at": archived_at}))


def processed_ids():
    with db.get_engine().connect() as c:
        return {r[0] for r in c.execute(sa.select(db.emails.c.id))}


def _get(c, email_id):
    r = c.execute(sa.select(db.emails).where(db.emails.c.id == email_id)).mappings().first()
    if not r:
        raise ServiceError(404, "Email not found")
    return dict(r)


def comparison_rows(row):
    if row["category"] != "BL_COMPARISON":
        return []
    return compare(row["si_fields"] or {}, row["bl_fields"] or {})


def summary(row):
    return {k: row[k] for k in (
        "id", "sender", "subject", "category", "confidence", "status",
        "processed_at", "shipment_ref", "resolved_by", "archived_at")}


def _in_view(archived):
    """SQL condition selecting archived or active (not archived) emails."""
    col = db.emails.c.archived_at
    return col.is_not(None) if archived else col.is_(None)


def list_emails(category=None, status=None, q=None, archived=False):
    stmt = sa.select(db.emails).where(_in_view(archived)).order_by(db.emails.c.id)
    with db.get_engine().connect() as c:
        rows = [dict(r) for r in c.execute(stmt).mappings()]
    out = []
    for r in rows:
        if category and r["category"] != category:
            continue
        if status and r["status"] != status:
            continue
        if q and q.lower() not in f"{r['sender']} {r['subject']} {r['shipment_ref'] or ''}".lower():
            continue
        out.append(summary(r))
    return out


def stats():
    """Dashboard counts for active emails only; archived ones are counted separately."""
    with db.get_engine().connect() as c:
        rows = list(c.execute(sa.select(db.emails.c.status, db.emails.c.category).where(_in_view(False))))
        archived = c.execute(
            sa.select(sa.func.count()).select_from(db.emails).where(_in_view(True))).scalar()
    statuses = [r[0] for r in rows]
    by_category = {}
    for _, cat in rows:
        by_category[cat] = by_category.get(cat, 0) + 1
    return {
        "by_category": by_category,
        "archived": archived,
        "total": len(statuses),
        "mismatches": statuses.count("MISMATCH"),
        "needs_review": statuses.count("NEEDS_REVIEW"),
        "clean": statuses.count("OK"),
    }


def edit_history(c, email_id):
    q = sa.select(db.edit_log).where(db.edit_log.c.email_id == email_id).order_by(db.edit_log.c.id.desc())
    return [dict(r) for r in c.execute(q).mappings()]


def detail(email_id):
    with db.get_engine().connect() as c:
        row = _get(c, email_id)
        history = edit_history(c, email_id)
    rows = comparison_rows(row)
    out = summary(row)
    out.update(
        body=row["body"], attachments=row["attachments"], rationale=row["rationale"],
        comparison=rows, reasons=row["reasons"], escalated_by=row["escalated_by"],
        resolved_at=row["resolved_at"], si_evidence=row["si_evidence"], bl_evidence=row["bl_evidence"],
        edit_log=history)
    return out


def source(email_id):
    with db.get_engine().connect() as c:
        row = _get(c, email_id)
    return {"id": email_id, "subject": row["subject"], "body": row["body"],
            "si_text": row["si_text"], "bl_text": row["bl_text"]}


def review_queue():
    with db.get_engine().connect() as c:
        rows = [dict(r) for r in c.execute(
            sa.select(db.emails).where(db.emails.c.status == "NEEDS_REVIEW", _in_view(False))
            .order_by(db.emails.c.id)).mappings()]
    return [{**summary(r), "reasons": r["reasons"], "escalated_by": r["escalated_by"]} for r in rows]


CATEGORIES = ("BL_COMPARISON", "SI_REQUEST", "INVOICE_QUERY", "GENERAL", "SPAM")
RESET_COLUMNS = ("confidence", "rationale", "status", "si_fields", "bl_fields", "si_evidence",
                 "bl_evidence", "si_text", "bl_text", "reasons")


def change_category(email_id, new_category, editor, reason_text, process_fn):
    """Reviewer override of the category. process_fn(email_dict, category) -> pipeline row."""
    if new_category not in CATEGORIES:
        raise ServiceError(400, "unknown category")
    if not (editor or "").strip():
        raise ServiceError(400, "editor name is required")
    if not (reason_text or "").strip():
        raise ServiceError(400, "a reason is required")
    with db.get_engine().connect() as c:
        row = _get(c, email_id)
    if row["category"] == new_category:
        raise ServiceError(400, "email already has this category")
    email = {"email_id": email_id, "from": row["sender"], "subject": row["subject"],
             "body": row["body"], "attachments": row["attachments"] or []}
    new = process_fn(email, new_category) if new_category == "BL_COMPARISON" else {
        "confidence": None, "rationale": "Category set manually by a reviewer", "status": "CLASSIFIED",
        "si_fields": None, "bl_fields": None, "si_evidence": None, "bl_evidence": None,
        "si_text": None, "bl_text": None, "reasons": []}
    values = {k: new[k] for k in RESET_COLUMNS}
    values.update(category=new_category, resolved_by=None, resolved_at=None, escalated_by=None)
    with db.get_engine().begin() as c:
        c.execute(sa.update(db.emails).where(db.emails.c.id == email_id).values(**values))
        c.execute(sa.insert(db.edit_log).values(
            email_id=email_id, doc="EMAIL", field="category", old_value=row["category"],
            new_value=new_category, editor=editor.strip(), reason=reason_text.strip(), timestamp=now()))
    return detail(email_id)


def set_archived(ids, archived):
    """Archive or unarchive emails. Nothing is removed: results, edits and history are kept.

    Returns how many emails actually changed; ones already in the requested state are skipped.
    """
    ids = list(dict.fromkeys(ids))
    if not ids:
        raise ServiceError(400, "No emails selected")
    with db.get_engine().begin() as c:
        found = c.execute(
            sa.select(sa.func.count()).select_from(db.emails).where(db.emails.c.id.in_(ids))).scalar()
        if not found:
            raise ServiceError(404, "Email not found")
        res = c.execute(sa.update(db.emails)
                        .where(db.emails.c.id.in_(ids), _in_view(not archived))
                        .values(archived_at=now() if archived else None))
    return {"changed": res.rowcount}


def parse_value(field, raw):
    raw = (raw if raw is not None else "")
    raw = str(raw).strip()
    if not raw:
        raise ServiceError(400, "new_value must not be empty")
    if field in NUMERIC_FIELDS:
        try:
            num = float(raw.replace(",", ""))
        except ValueError:
            raise ServiceError(400, f"{field} must be a number")
        if field == "container_count":
            if num != int(num) or num < 0:
                raise ServiceError(400, "container_count must be a whole number")
            return int(num)
        if num < 0:
            raise ServiceError(400, "gross_weight_kg must not be negative")
        return num
    return raw


def _recompute(row):
    row["status"] = verdict(comparison_rows(row), row["reasons"])


def _persist(c, row):
    c.execute(sa.update(db.emails).where(db.emails.c.id == row["id"]).values(
        si_fields=row["si_fields"], bl_fields=row["bl_fields"], reasons=row["reasons"],
        status=row["status"], resolved_by=row["resolved_by"], resolved_at=row["resolved_at"],
        escalated_by=row["escalated_by"]))


def apply_edit(email_id, doc, field, new_value, editor, reason_text):
    doc = (doc or "").upper()
    if doc not in DOCS:
        raise ServiceError(400, "doc must be SI or BL")
    if field not in FIELDS:
        raise ServiceError(400, f"unknown field {field}")
    if not (editor or "").strip():
        raise ServiceError(400, "editor name is required")
    if not (reason_text or "").strip():
        raise ServiceError(400, "a reason is required")
    value = parse_value(field, new_value)

    with db.get_engine().begin() as c:
        row = _get(c, email_id)
        if row["category"] != "BL_COMPARISON":
            raise ServiceError(400, "Only document-comparison emails have editable fields")
        key = f"{doc.lower()}_fields"
        fields = dict(row[key] or {f: None for f in FIELDS})
        old = fields.get(field)
        if old == value:
            raise ServiceError(400, "new value is the same as the current value")
        fields[field] = value
        row[key] = fields
        row["reasons"] = [
            r for r in (row["reasons"] or [])
            if not (r["code"] in CLEARED_ON_EDIT and r.get("doc") == doc and r.get("field") == field)
        ]
        row["resolved_by"] = row["resolved_at"] = None
        _recompute(row)
        c.execute(sa.insert(db.edit_log).values(
            email_id=email_id, doc=doc, field=field,
            old_value=None if old is None else str(old), new_value=str(value),
            editor=editor.strip(), reason=reason_text.strip(), timestamp=now()))
        _persist(c, row)
    return detail(email_id)


def escalate(email_id, editor, note=""):
    if not (editor or "").strip():
        raise ServiceError(400, "editor name is required")
    with db.get_engine().begin() as c:
        row = _get(c, email_id)
        row["reasons"] = list(row["reasons"] or [])
        if not any(r["code"] == "manual_escalation" for r in row["reasons"]):
            row["reasons"].append(reason(
                "manual_escalation", f"Escalated to team by {editor.strip()}",
                note.strip() or f"Subject: {row['subject']}"))
        row["escalated_by"] = editor.strip()
        row["resolved_by"] = row["resolved_at"] = None
        _recompute(row)
        _persist(c, row)
    return detail(email_id)


def resolve(email_id, editor):
    if not (editor or "").strip():
        raise ServiceError(400, "editor name is required")
    with db.get_engine().begin() as c:
        row = _get(c, email_id)
        if row["category"] == "BL_COMPARISON":
            missing = missing_fields(comparison_rows(row))
            if missing:
                raise ServiceError(409, "Cannot resolve while fields are missing: "
                                        + ", ".join(missing) + ". Correct them with Edit first.")
        row["reasons"] = []
        row["resolved_by"], row["resolved_at"] = editor.strip(), now()
        if row["category"] == "BL_COMPARISON":
            _recompute(row)
        else:
            row["status"] = "CLASSIFIED"
        _persist(c, row)
    return detail(email_id)
