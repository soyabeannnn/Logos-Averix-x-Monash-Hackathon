"""classify -> extract -> compare -> escalate. Returns a row dict ready to store."""
from datetime import datetime, timezone

from . import config, llm
from .compare import compare, verdict
from .documents import attachment_text, is_readable
from .escalation import (
    disagreement_reasons, low_confidence_reason, missing_value_reasons, reason,
)
from .fields import FIELDS


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def find_attachment(paths, doc):
    for p in paths:
        base = p.rsplit("/", 1)[-1].rsplit(".", 1)[0].upper()
        if base.endswith("_" + doc):
            return p
    return None


def empty_fields():
    return {f: None for f in FIELDS}


def extract_document(text, doc, consistency=None):
    """Extract one document. Returns (fields, evidence, doc_type, reasons)."""
    consistency = config.CONSISTENCY_CHECK if consistency is None else consistency
    first = llm.extract_fields(text, doc)
    fields = {f: first["fields"][f]["value"] for f in FIELDS}
    evidence = {f: first["fields"][f]["evidence"] for f in FIELDS}
    reasons = []
    if consistency and first["doc_type"] == doc:
        second = llm.extract_fields(text, doc)
        s_fields = {f: second["fields"][f]["value"] for f in FIELDS}
        s_ev = {f: second["fields"][f]["evidence"] for f in FIELDS}
        reasons += disagreement_reasons(doc, fields, s_fields, evidence, s_ev)
    return fields, evidence, first["doc_type"], reasons


def process_email(email, inbox):
    paths = email.get("attachments") or []
    row = {
        "id": email["email_id"], "sender": email.get("from"), "subject": email.get("subject"),
        "body": email.get("body"), "attachments": paths, "category": None, "confidence": None,
        "rationale": None, "shipment_ref": None, "status": None, "processed_at": now(),
        "si_fields": None, "bl_fields": None, "si_evidence": None, "bl_evidence": None,
        "si_text": None, "bl_text": None, "reasons": [], "resolved_by": None,
        "resolved_at": None, "escalated_by": None,
    }
    excerpt = f"Subject: {row['subject']}\n\n{(row['body'] or '')[:600]}"

    try:
        c = llm.classify_email(email, [p.rsplit("/", 1)[-1] for p in paths])
    except llm.LLMError as e:
        row["category"] = "UNKNOWN"
        row["reasons"].append(reason("llm_error", f"Classification failed after retry: {e}", excerpt))
        row["status"] = "NEEDS_REVIEW"
        return row

    row.update(category=c["category"], confidence=c["confidence"],
               rationale=c["rationale"], shipment_ref=c.get("shipment_ref"))
    low = low_confidence_reason(c["confidence"], config.LOW_CONFIDENCE, excerpt)
    if low:
        row["reasons"].append(low)

    if c["category"] != "BL_COMPARISON":
        row["status"] = "NEEDS_REVIEW" if row["reasons"] else "CLASSIFIED"
        return row

    si_fields, bl_fields = empty_fields(), empty_fields()
    for doc in ("SI", "BL"):
        key = doc.lower()
        path = find_attachment(paths, doc)
        fields, evidence = empty_fields(), {}
        if not path:
            row["reasons"].append(reason(
                "missing_attachment", f"No {doc} attachment found",
                f"Attachments on email: {', '.join(paths) or 'none'}", doc))
        else:
            try:
                text = attachment_text(inbox, path)
            except Exception as e:
                text = ""
                row["reasons"].append(reason(
                    "unreadable", f"{doc} could not be opened: {e}", path, doc))
            row[f"{key}_text"] = text
            if text and not is_readable(text):
                row["reasons"].append(reason(
                    "unreadable", f"{doc} has no extractable text (scanned image?)", text[:600] or path, doc))
            elif text:
                try:
                    fields, evidence, doc_type, extra = extract_document(text, doc)
                    if doc_type != doc:
                        row["reasons"].append(reason(
                            "wrong_doc_type", f"Attachment named {doc} looks like a {doc_type} document",
                            text[:600], doc))
                        fields, evidence = empty_fields(), {}
                    else:
                        row["reasons"] += extra
                        row["reasons"] += missing_value_reasons(doc, fields, evidence, text)
                except llm.LLMError as e:
                    row["reasons"].append(reason(
                        "llm_error", f"{doc} extraction failed after retry: {e}", text[:600], doc))
        row[f"{key}_fields"], row[f"{key}_evidence"] = fields, evidence

    rows = compare(row["si_fields"], row["bl_fields"])
    row["status"] = verdict(rows, row["reasons"])
    return row
