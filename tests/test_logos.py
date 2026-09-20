import sys
from pathlib import Path

import pytest
import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from logos import config, db, documents, llm, pipeline, service  # noqa: E402
from logos.compare import compare, mismatched_fields, verdict  # noqa: E402
from logos.escalation import disagreement_reasons, low_confidence_reason  # noqa: E402
from logos.fields import FIELDS, normalize_label  # noqa: E402

GOOD = {
    "shipper": "ACME LTD", "consignee": "BETA CO", "notify_party": "GAMMA",
    "port_of_loading": "PORT KLANG", "port_of_discharge": "CALLAO",
    "container_count": 1, "gross_weight_kg": 21577.0,
}


# ---- label normalization ----
@pytest.mark.parametrize("label,field", [
    ("Port of Loading", "port_of_loading"), ("Load Port", "port_of_loading"),
    ("POL", "port_of_loading"), ("Discharge Port", "port_of_discharge"),
    ("Gross Wt (kgs)", "gross_weight_kg"), ("Gross Weight (KG):", "gross_weight_kg"),
    ("Shipper/Exporter", "shipper"), ("Notify", "notify_party"),
    ("No. of Containers or Packages", "container_count"),
])
def test_label_variants_map_to_same_field(label, field):
    assert normalize_label(label) == field


def test_unknown_label_is_not_mapped():
    assert normalize_label("Vessel Name") is None


# ---- deterministic comparison ----
def test_identical_documents_match():
    rows = compare(GOOD, dict(GOOD))
    assert mismatched_fields(rows) == []
    assert verdict(rows, []) == "OK"


def test_text_is_case_and_whitespace_normalized():
    bl = {**GOOD, "shipper": "  acme   ltd ", "port_of_loading": "port klang"}
    assert mismatched_fields(compare(GOOD, bl)) == []


def test_numbers_are_exact():
    bl = {**GOOD, "gross_weight_kg": 21577.5, "container_count": 2}
    assert mismatched_fields(compare(GOOD, bl)) == ["container_count", "gross_weight_kg"]


def test_real_text_difference_is_flagged():
    bl = {**GOOD, "consignee": "DELTA CO"}
    rows = compare(GOOD, bl)
    assert mismatched_fields(rows) == ["consignee"]
    assert verdict(rows, []) == "MISMATCH"


def test_missing_value_is_not_treated_as_match_or_mismatch():
    rows = compare(GOOD, {**GOOD, "notify_party": None})
    assert [r["match"] for r in rows if r["field"] == "notify_party"] == [None]
    assert verdict(rows, []) == "NEEDS_REVIEW"


# ---- escalation triggers ----
def test_low_confidence_triggers_only_below_threshold():
    assert low_confidence_reason(0.5, 0.7, "x")["code"] == "low_confidence"
    assert low_confidence_reason(0.9, 0.7, "x") is None


def test_retry_disagreement_reports_field_and_evidence():
    second = {**GOOD, "gross_weight_kg": 21500.0}
    out = disagreement_reasons("BL", GOOD, second, {"gross_weight_kg": "line A"}, {"gross_weight_kg": "line B"})
    assert [r["field"] for r in out] == ["gross_weight_kg"]
    assert "line A" in out[0]["evidence"] and "line B" in out[0]["evidence"]


# ---- pipeline with a stubbed LLM ----
class FakeInbox:
    def __init__(self, files):
        self.files = files

    def read_text(self, p):
        return self.files[p]

    def read_bytes(self, p):
        return self.files[p].encode()


def stub_llm(monkeypatch, category="BL_COMPARISON", confidence=0.95, si=None, bl=None, bl_type="BL"):
    def classify(email, names, model=None):
        return {"category": category, "confidence": confidence, "shipment_ref": "REF1", "rationale": "t"}

    def extract(text, doc, model=None):
        vals = si if doc == "SI" else bl
        return {"doc_type": "SI" if doc == "SI" else bl_type,
                "fields": {f: {"value": (vals or GOOD)[f], "evidence": f"line for {f}"} for f in FIELDS}}
    monkeypatch.setattr(llm, "classify_email", classify)
    monkeypatch.setattr(llm, "extract_fields", extract)


EMAIL = {"email_id": "email_900", "from": "a@b.c", "subject": "check", "body": "pls check",
         "attachments": ["attachments/email_900_SI.txt", "attachments/email_900_BL.txt"]}
DOCS = FakeInbox({p: "x" * 100 for p in EMAIL["attachments"]})


def test_pipeline_flags_mismatch(monkeypatch):
    stub_llm(monkeypatch, bl={**GOOD, "consignee": "OTHER"})
    row = pipeline.process_email(EMAIL, DOCS)
    assert row["status"] == "MISMATCH" and row["reasons"] == []


def test_pipeline_escalates_missing_field_with_evidence(monkeypatch):
    stub_llm(monkeypatch, bl={**GOOD, "notify_party": None})
    row = pipeline.process_email(EMAIL, DOCS)
    assert row["status"] == "NEEDS_REVIEW"
    assert row["reasons"][0]["code"] == "missing_value" and row["reasons"][0]["evidence"]


def test_pipeline_escalates_when_retry_disagrees(monkeypatch):
    monkeypatch.setattr(config, "CONSISTENCY_CHECK", True)
    stub_llm(monkeypatch)
    calls = {"n": 0}
    real = llm.extract_fields

    def flaky(text, doc, model=None):
        out = real(text, doc)
        calls["n"] += 1
        if doc == "BL" and calls["n"] == 4:  # calls: SI, SI retry, BL, BL retry
            out["fields"]["gross_weight_kg"]["value"] = 1.0
        return out
    monkeypatch.setattr(llm, "extract_fields", flaky)
    row = pipeline.process_email(EMAIL, DOCS)
    assert row["status"] == "NEEDS_REVIEW"
    assert any(r["code"] == "retry_disagreement" for r in row["reasons"])


def test_pipeline_escalates_missing_attachment_and_wrong_doc_and_unreadable(monkeypatch):
    stub_llm(monkeypatch)
    no_bl = {**EMAIL, "attachments": [EMAIL["attachments"][0]]}
    assert any(r["code"] == "missing_attachment" for r in pipeline.process_email(no_bl, DOCS)["reasons"])
    stub_llm(monkeypatch, bl_type="OTHER")
    assert any(r["code"] == "wrong_doc_type" for r in pipeline.process_email(EMAIL, DOCS)["reasons"])
    blank = FakeInbox({p: "  " for p in EMAIL["attachments"]})
    assert any(r["code"] == "unreadable" for r in pipeline.process_email(EMAIL, blank)["reasons"])


def test_pipeline_escalates_low_confidence_and_non_comparison_is_not_extracted(monkeypatch):
    stub_llm(monkeypatch, category="SPAM", confidence=0.4)
    row = pipeline.process_email(EMAIL, DOCS)
    assert row["status"] == "NEEDS_REVIEW" and row["si_fields"] is None
    stub_llm(monkeypatch, category="SPAM", confidence=0.99)
    assert pipeline.process_email(EMAIL, DOCS)["status"] == "CLASSIFIED"


def test_llm_failure_after_retry_escalates_instead_of_crashing(monkeypatch):
    def boom(*a, **k):
        raise llm.LLMError("bad json")
    monkeypatch.setattr(llm, "_call_tool", boom)
    row = pipeline.process_email(EMAIL, DOCS)
    assert row["status"] == "NEEDS_REVIEW" and row["reasons"][0]["code"] == "llm_error"


def test_malformed_output_is_retried_once():
    outputs = iter([{"category": "nonsense", "confidence": 0.9, "shipment_ref": None, "rationale": ""},
                    {"category": "SPAM", "confidence": 0.9, "shipment_ref": None, "rationale": ""}])
    out = llm._with_retry(lambda: next(outputs), llm._validate_classification)
    assert out["category"] == "SPAM"


# ---- edits + audit log ----
@pytest.fixture()
def store(monkeypatch):
    db.set_engine(sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool,
                                   connect_args={"check_same_thread": False}))
    stub_llm(monkeypatch, bl={**GOOD, "notify_party": None, "consignee": "OTHER"})
    service.save_row(pipeline.process_email(EMAIL, DOCS))
    return EMAIL["email_id"]


def test_edit_logs_entry_and_recomputes_verdict(store):
    assert service.detail(store)["edit_log"] == []
    d = service.apply_edit(store, "BL", "consignee", "BETA CO", "Ana", "typo on BL")
    entry = d["edit_log"][0]
    assert (entry["field"], entry["old_value"], entry["new_value"], entry["editor"], entry["reason"]) == \
        ("consignee", "OTHER", "BETA CO", "Ana", "typo on BL")
    assert entry["timestamp"]
    # notify_party still missing -> still needs review; fill it and verdict becomes OK
    assert d["status"] == "NEEDS_REVIEW"
    d = service.apply_edit(store, "BL", "notify_party", "GAMMA", "Ana", "read from scan")
    assert d["status"] == "OK" and len(d["edit_log"]) == 2


def test_edit_requires_reason_and_editor(store):
    with pytest.raises(service.ServiceError):
        service.apply_edit(store, "BL", "consignee", "X", "Ana", "  ")
    with pytest.raises(service.ServiceError):
        service.apply_edit(store, "BL", "consignee", "X", "", "why")
    assert service.detail(store)["edit_log"] == []


def test_cannot_resolve_with_missing_fields(store):
    with pytest.raises(service.ServiceError) as e:
        service.resolve(store, "Ana")
    assert e.value.status == 409


def test_delete_removes_email_and_its_edit_log(store):
    service.apply_edit(store, "BL", "consignee", "BETA CO", "Ana", "typo")
    assert service.delete_emails([store]) == {"deleted": 1}
    with pytest.raises(service.ServiceError) as e:
        service.detail(store)
    assert e.value.status == 404
    with db.get_engine().connect() as c:
        assert c.execute(sa.select(sa.func.count()).select_from(db.edit_log)).scalar() == 0
    with pytest.raises(service.ServiceError):
        service.delete_emails([])


def test_category_change_logs_and_switches_pipeline_state(store):
    calls = []

    def fake_process(email, cat):
        calls.append(cat)
        return {"confidence": None, "rationale": "manual", "status": "OK", "si_fields": GOOD, "bl_fields": GOOD,
                "si_evidence": {}, "bl_evidence": {}, "si_text": "s", "bl_text": "b", "reasons": []}
    d = service.change_category(store, "SPAM", "Ana", "not a real request", fake_process)
    assert d["category"] == "SPAM" and d["status"] == "CLASSIFIED" and d["comparison"] == [] and calls == []
    assert d["edit_log"][0]["field"] == "category" and d["edit_log"][0]["old_value"] == "BL_COMPARISON"
    d = service.change_category(store, "BL_COMPARISON", "Ana", "it is a comparison", fake_process)
    assert calls == ["BL_COMPARISON"] and d["status"] == "OK" and len(d["edit_log"]) == 2
    with pytest.raises(service.ServiceError):
        service.change_category(store, "GENERAL", "Ana", " ", fake_process)
    with pytest.raises(service.ServiceError):
        service.change_category(store, "BL_COMPARISON", "Ana", "same", fake_process)


# ---- scanned PDFs are read by the model instead of being escalated ----
def _pdf_email(bl_pdf):
    paths = ["attachments/email_901_SI.txt", "attachments/email_901_BL.pdf"]
    return {**EMAIL, "attachments": paths}, FakeInbox({paths[0]: "x" * 100, paths[1]: bl_pdf})


def test_scanned_pdf_is_sent_to_the_model_as_a_pdf(monkeypatch):
    stub_llm(monkeypatch)
    seen = {}
    real = llm.extract_fields

    def spy(text, doc, model=None, pdf=None):
        seen[doc] = pdf
        return real(text, doc)
    monkeypatch.setattr(llm, "extract_fields", spy)
    monkeypatch.setattr(pipeline, "attachment_text", lambda inbox, p: "" if p.endswith(".pdf") else "x" * 100)
    email, inbox = _pdf_email("%PDF-scan")
    row = pipeline.process_email(email, inbox)
    assert seen["BL"] == b"%PDF-scan" and seen["SI"] is None
    assert row["status"] == "OK" and row["bl_text"] == documents.SCANNED_PDF_NOTE


def test_corrupt_pdf_still_escalates_and_is_not_sent_to_the_model(monkeypatch):
    stub_llm(monkeypatch)

    def cannot_open(inbox, p):
        if p.endswith(".pdf"):
            raise ValueError("Stream has ended unexpectedly")
        return "x" * 100
    monkeypatch.setattr(pipeline, "attachment_text", cannot_open)
    email, inbox = _pdf_email("%PDF-broken")
    row = pipeline.process_email(email, inbox)
    assert row["status"] == "NEEDS_REVIEW"
    assert [r["code"] for r in row["reasons"]] == ["unreadable"]


def test_pdf_block_is_base64_document():
    block = llm._pdf_block(b"abc")
    assert block["type"] == "document" and block["source"]["media_type"] == "application/pdf"
    assert block["source"]["data"] == "YWJj"
