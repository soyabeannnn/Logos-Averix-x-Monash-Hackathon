"""Format-independent report content, built from service.detail(). No rendering here."""
from dataclasses import dataclass
from datetime import datetime, timezone

from ..fields import FIELD_LABELS

CATEGORY_LABELS = {
    "BL_COMPARISON": "Comparison", "SI_REQUEST": "New SI", "INVOICE_QUERY": "Invoice",
    "GENERAL": "General", "SPAM": "Spam", "UNKNOWN": "Unclassified",
}
STATUS_LABELS = {"OK": "Matched", "MISMATCH": "Mismatch", "NEEDS_REVIEW": "Needs Review"}
MISSING = "missing"
EVIDENCE_LIMIT = 800


@dataclass(frozen=True)
class ComparisonRow:
    label: str
    si: str
    bl: str
    result: str  # "Match" | "Mismatch" | "Missing"


@dataclass(frozen=True)
class Escalation:
    message: str
    evidence: str


@dataclass(frozen=True)
class Edit:
    label: str
    old: str
    new: str
    editor: str
    timestamp: str
    reason: str


@dataclass(frozen=True)
class Report:
    email_id: str
    title: str
    generated_at: str
    meta: list  # [(label, value)]
    status: str  # OK | MISMATCH | NEEDS_REVIEW
    verdict: str
    escalations: list
    rows: list
    history: list


def _fmt_value(value):
    if value is None:
        return MISSING
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return f"{value:,}" if isinstance(value, (int, float)) else str(value)


def _fmt_time(iso):
    if not iso:
        return ""
    return datetime.fromisoformat(iso).strftime("%Y-%m-%d %H:%M UTC")


def _verdict(detail, rows):
    mismatches = sum(r.result == "Mismatch" for r in rows)
    if detail["status"] == "NEEDS_REVIEW":
        text = f"Needs review. {len(detail['reasons'])} open escalation(s); a reviewer must confirm this case."
    elif detail["status"] == "MISMATCH":
        text = f"Mismatch. {mismatches} of {len(rows)} fields differ between the SI and the draft BL."
    else:
        text = f"Matched. All {len(rows)} fields agree between the SI and the draft BL."
    if detail.get("resolved_by"):
        text += f" Resolved by {detail['resolved_by']} on {_fmt_time(detail['resolved_at'])}."
    return text


def _edit(entry):
    is_category = entry["field"] == "category"
    label = "Category" if is_category else f"{FIELD_LABELS[entry['field']]} ({entry['doc']})"
    fmt = (lambda v: CATEGORY_LABELS.get(v, v)) if is_category else _fmt_value
    return Edit(label, fmt(entry["old_value"]), fmt(entry["new_value"]),
                entry["editor"], _fmt_time(entry["timestamp"]), entry["reason"])


def build_report(detail, generated_at=None):
    """detail is the dict returned by service.detail() for a comparison email."""
    rows = [ComparisonRow(
        FIELD_LABELS[r["field"]], _fmt_value(r["si"]), _fmt_value(r["bl"]),
        {True: "Match", False: "Mismatch", None: "Missing"}[r["match"]]) for r in detail["comparison"]]
    confidence = detail["confidence"]
    meta = [
        ("From", detail["sender"]),
        ("Processed", _fmt_time(detail["processed_at"])),
        ("Category", CATEGORY_LABELS.get(detail["category"], detail["category"])),
        ("Classification confidence", f"{round(confidence * 100)}%" if confidence is not None else "n/a"),
        ("Shipment ref", detail["shipment_ref"] or "not stated"),
    ]
    return Report(
        email_id=detail["id"], title=detail["subject"],
        generated_at=generated_at or datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        meta=meta, status=detail["status"], verdict=_verdict(detail, rows),
        escalations=[Escalation(r["message"], (r.get("evidence") or "")[:EVIDENCE_LIMIT]) for r in detail["reasons"]],
        rows=rows, history=[_edit(e) for e in detail["edit_log"]])
