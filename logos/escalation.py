"""Escalation triggers. Each reason carries a code, a message and source evidence."""
from .fields import FIELDS, FIELD_LABELS
from .compare import norm_text

CODES = {
    "low_confidence", "missing_attachment", "wrong_doc_type", "unreadable",
    "missing_value", "retry_disagreement", "llm_error", "manual_escalation",
}


def reason(code, message, evidence="", doc=None, field=None):
    assert code in CODES
    return {"code": code, "message": message, "evidence": evidence, "doc": doc, "field": field}


def low_confidence_reason(confidence, threshold, evidence):
    if confidence < threshold:
        return reason(
            "low_confidence",
            f"Classification confidence {confidence:.2f} is below {threshold:.2f}",
            evidence,
        )
    return None


def missing_value_reasons(doc, fields, field_evidence, raw_text):
    out = []
    for f in FIELDS:
        if fields.get(f) is None:
            ev = (field_evidence or {}).get(f) or raw_text[:600]
            out.append(reason("missing_value", f"{doc}: {FIELD_LABELS[f]} missing or unreadable", ev, doc, f))
    return out


def _same(f, a, b):
    if a is None or b is None:
        return a is b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return float(a) == float(b)
    return norm_text(a) == norm_text(b)


def disagreement_reasons(doc, first, second, first_ev, second_ev):
    out = []
    for f in FIELDS:
        if not _same(f, first.get(f), second.get(f)):
            ev = (f"pass 1: {first.get(f)!r} — {(first_ev or {}).get(f, '')}\n"
                  f"pass 2: {second.get(f)!r} — {(second_ev or {}).get(f, '')}")
            out.append(reason(
                "retry_disagreement",
                f"{doc}: {FIELD_LABELS[f]} extraction disagreed on retry", ev, doc, f))
    return out
