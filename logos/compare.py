"""Deterministic SI-vs-BL comparison. No LLM involved."""
from .fields import FIELDS, NUMERIC_FIELDS


def norm_text(v) -> str:
    return " ".join(str(v).split()).casefold()


def values_equal(field: str, a, b) -> bool:
    if field in NUMERIC_FIELDS:
        return float(a) == float(b)
    return norm_text(a) == norm_text(b)


def compare(si: dict, bl: dict) -> list:
    """One row per field. match is True/False, or None when either side is missing."""
    rows = []
    for f in FIELDS:
        a, b = (si or {}).get(f), (bl or {}).get(f)
        if a is None or b is None:
            match = None
        else:
            match = values_equal(f, a, b)
        rows.append({"field": f, "si": a, "bl": b, "match": match})
    return rows


def mismatched_fields(rows: list) -> list:
    return [r["field"] for r in rows if r["match"] is False]


def missing_fields(rows: list) -> list:
    return [r["field"] for r in rows if r["match"] is None]


def verdict(rows: list, open_reasons: list) -> str:
    """NEEDS_REVIEW while any escalation is open; otherwise MISMATCH or OK."""
    if open_reasons:
        return "NEEDS_REVIEW"
    if missing_fields(rows):
        return "NEEDS_REVIEW"
    return "MISMATCH" if mismatched_fields(rows) else "OK"
