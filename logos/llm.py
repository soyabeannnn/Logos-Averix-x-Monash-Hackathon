"""Anthropic calls with forced tool output (fixed JSON schema). One retry, then LLMError."""
import logging

from . import config
from .fields import FIELDS, alias_prompt_block

log = logging.getLogger("logos.llm")

CATEGORIES = ["BL_COMPARISON", "SI_REQUEST", "INVOICE_QUERY", "GENERAL", "SPAM"]


class LLMError(Exception):
    pass


_client = None


def get_client():
    global _client
    if _client is None:
        import anthropic
        _client = anthropic.Anthropic()
    return _client


CLASSIFY_TOOL = {
    "name": "classify_email",
    "description": "Record the classification of a shipping-operations email.",
    "input_schema": {
        "type": "object",
        "properties": {
            "category": {"type": "string", "enum": CATEGORIES},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "shipment_ref": {"type": ["string", "null"], "description": "Booking/OC/BL reference if stated"},
            "rationale": {"type": "string"},
        },
        "required": ["category", "confidence", "shipment_ref", "rationale"],
    },
}

CLASSIFY_SYSTEM = """You triage a shipping-operations inbox. Classify each email as exactly one of:
- BL_COMPARISON: the sender supplies a Shipping Instruction (SI) and a draft Bill of Lading (BL) and asks for them to be checked/confirmed/compared ("attached are the SI and draft BL ... please check"); usually attaches both. Still BL_COMPARISON if the sender says the documents are attached but a file seems to be missing.
  NOT BL_COMPARISON: a request that asks the recipient to SEND or PROVIDE a draft BL (e.g. "Please assist to send the draft BL for <ref> for checking asap", subjects like "Draft BL ... - amend BL 058"). Nothing is supplied to compare, so classify these as GENERAL.
- SI_REQUEST: a new shipping instruction / booking request to be actioned (not a comparison of existing documents).
- INVOICE_QUERY: a question about an invoice, charges, payment or billing.
- GENERAL: any other legitimate business message.
- SPAM: unsolicited marketing, phishing or irrelevant mail.
Set confidence to your honest probability (0-1) that the category is right; use lower values when the email is ambiguous or fits two categories."""


def _field_prop(t):
    return {
        "type": "object",
        "properties": {"value": {"type": [t, "null"]}, "evidence": {"type": "string"}},
        "required": ["value", "evidence"],
    }


EXTRACT_TOOL = {
    "name": "record_fields",
    "description": "Record the 7 fields extracted from a shipping document.",
    "input_schema": {
        "type": "object",
        "properties": {
            "doc_type": {"type": "string", "enum": ["SI", "BL", "OTHER"]},
            "fields": {
                "type": "object",
                "properties": {
                    "shipper": _field_prop("string"),
                    "consignee": _field_prop("string"),
                    "notify_party": _field_prop("string"),
                    "port_of_loading": _field_prop("string"),
                    "port_of_discharge": _field_prop("string"),
                    "container_count": _field_prop("integer"),
                    "gross_weight_kg": _field_prop("number"),
                },
                "required": FIELDS,
            },
        },
        "required": ["doc_type", "fields"],
    },
}

EXTRACT_SYSTEM = f"""You extract fields from a shipping document (a Shipping Instruction "SI" or a draft Bill of Lading "BL").
First set doc_type to what the document actually is (SI, BL, or OTHER if it is neither, e.g. an invoice or packing list).

Extract exactly these 7 fields. Documents label the same field differently; treat these labels as equivalent:
{alias_prompt_block()}

Rules:
- Copy text values verbatim from the document. For shipper, consignee and notify_party give the party NAME only (no address lines, phone numbers or tax IDs). For ports give the port text as written (including country/UN code if present on that line).
- container_count: the NUMBER of containers as an integer (e.g. "1 x 40'HC" -> 1, "2X20GP" -> 2). If only a package count is given and no containers, use null.
- gross_weight_kg: a number in kilograms, without thousands separators. Convert only when the unit is explicit (1 MT = 1000 kg). Do not use net or tare weight.
- If a field is absent, blank, illegible or ambiguous, set value to null. Never guess or infer a value that is not in the document.
- evidence: the exact line(s) from the document the value came from (empty string if value is null)."""


def _call_tool(model, system, user, tool, max_tokens=1500):
    try:
        resp = get_client().messages.create(
            model=model, max_tokens=max_tokens, system=system, tools=[tool],
            tool_choice={"type": "tool", "name": tool["name"]},
            messages=[{"role": "user", "content": user}],
        )
    except Exception as e:  # network / API errors
        raise LLMError(f"API call failed: {e}") from e
    for block in resp.content:
        if block.type == "tool_use":
            return block.input
    raise LLMError("no tool_use block in response")


def _with_retry(fn, validate):
    last = None
    for attempt in (1, 2):
        try:
            out = fn()
            validate(out)
            return out
        except (LLMError, ValueError, KeyError, TypeError) as e:
            last = e
            log.warning("LLM attempt %d failed: %s", attempt, e)
    raise LLMError(str(last))


def _validate_classification(o):
    if o["category"] not in CATEGORIES:
        raise ValueError("bad category")
    c = float(o["confidence"])
    if not 0 <= c <= 1:
        raise ValueError("bad confidence")
    o["confidence"] = c


def _num(v, integer):
    if v is None:
        return None
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        raise ValueError(f"non-numeric value {v!r}")
    if integer:
        if float(v) != int(v):
            raise ValueError("non-integer container count")
        return int(v)
    return float(v)


def _validate_extraction(o):
    if o["doc_type"] not in ("SI", "BL", "OTHER"):
        raise ValueError("bad doc_type")
    f = o["fields"]
    for name in FIELDS:
        entry = f[name]
        v = entry["value"]
        if name == "container_count":
            v = _num(v, True)
        elif name == "gross_weight_kg":
            v = _num(v, False)
        elif v is not None:
            if not isinstance(v, str):
                raise ValueError(f"{name} must be a string")
            v = v.strip() or None
        entry["value"] = v
        entry["evidence"] = str(entry.get("evidence") or "")


def classify_email(email, attachment_names, model=None):
    user = (f"From: {email.get('from')}\nSubject: {email.get('subject')}\n"
            f"Attachments: {', '.join(attachment_names) or 'none'}\n\n{(email.get('body') or '')[:4000]}")
    return _with_retry(
        lambda: _call_tool(model or config.CLASSIFY_MODEL, CLASSIFY_SYSTEM, user, CLASSIFY_TOOL, 500),
        _validate_classification,
    )


def extract_fields(text, expected_doc, model=None):
    """Returns {doc_type, fields: {name: {value, evidence}}}."""
    user = f"Expected document type: {expected_doc}\n\n--- DOCUMENT START ---\n{text[:12000]}\n--- DOCUMENT END ---"
    return _with_retry(
        lambda: _call_tool(model or config.EXTRACT_MODEL, EXTRACT_SYSTEM, user, EXTRACT_TOOL, 2000),
        _validate_extraction,
    )
