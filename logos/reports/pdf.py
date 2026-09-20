"""Render a Report as a PDF (reportlab)."""
import io
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .model import Report

BORDER = colors.HexColor("#E3DBEE")
MUTED = colors.HexColor("#5B4F73")
HEADER_FILL = colors.HexColor("#F3EEFC")
STATUS_COLORS = {  # (background, text)
    "OK": ("#CDEFE0", "#146B45"),
    "MISMATCH": ("#FBD5E3", "#9B1C4A"),
    "NEEDS_REVIEW": ("#FFEDB5", "#6B4E00"),
}
ROW_TINT = {"Mismatch": "#FBD5E3", "Missing": "#FFEDB5"}
CONTENT_WIDTH = 17 * cm

_base = getSampleStyleSheet()
BODY = ParagraphStyle("body", parent=_base["BodyText"], fontSize=9.5, leading=13)
SMALL = ParagraphStyle("small", parent=BODY, fontSize=8.5, textColor=MUTED)
MONO = ParagraphStyle("mono", parent=BODY, fontName="Courier", fontSize=8, leading=10)
H1 = ParagraphStyle("h1", parent=_base["Heading1"], fontSize=16, leading=20, spaceAfter=4)
H2 = ParagraphStyle("h2", parent=_base["Heading2"], fontSize=12, leading=15, spaceBefore=14, spaceAfter=6)


def _p(text, style=BODY):
    return Paragraph(escape(str(text)).replace("\n", "<br/>"), style)


def _grid(data, widths, header=True, extra=()):
    table = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    styles = [
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        styles.append(("BACKGROUND", (0, 0), (-1, 0), HEADER_FILL))
    table.setStyle(TableStyle(styles + list(extra)))
    return table


def _verdict_box(report):
    background, text = STATUS_COLORS[report.status]
    style = ParagraphStyle("verdict", parent=BODY, textColor=colors.HexColor(text), fontName="Helvetica-Bold")
    box = Table([[_p(report.verdict, style)]], colWidths=[CONTENT_WIDTH])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(background)),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return box


def _comparison_table(report):
    head = [_p(h, SMALL) for h in ("Field", "SI (source of truth)", "Draft BL", "Result")]
    body = [[_p(r.label), _p(r.si), _p(r.bl), _p(r.result)] for r in report.rows]
    tint = [("BACKGROUND", (0, i), (-1, i), colors.HexColor(ROW_TINT[r.result]))
            for i, r in enumerate(report.rows, start=1) if r.result in ROW_TINT]
    return _grid([head] + body, [4 * cm, 5.5 * cm, 5.5 * cm, 2 * cm], extra=tint)


def _history_table(report):
    head = [_p(h, SMALL) for h in ("Field", "Old", "New", "Editor", "When", "Reason")]
    body = [[_p(e.label), _p(e.old), _p(e.new), _p(e.editor), _p(e.timestamp), _p(e.reason)]
            for e in report.history]
    return _grid([head] + body, [3 * cm, 2.6 * cm, 2.6 * cm, 2.2 * cm, 2.6 * cm, 4 * cm])


def render_pdf(report: Report) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=1.8 * cm,
        bottomMargin=1.8 * cm, title=f"Logos report {report.email_id}", author="Logos")

    story = [
        Paragraph('<font color="#D9703A">Logos</font> - SI vs draft BL comparison report', SMALL),
        _p(report.title, H1),
        _grid([[_p(k, SMALL), _p(v)] for k, v in report.meta], [5 * cm, 12 * cm], header=False),
        Spacer(1, 10),
        _verdict_box(report),
        _p("Field comparison", H2),
        _comparison_table(report),
    ]

    if report.escalations:
        story.append(_p("Open escalations", H2))
        for escalation in report.escalations:
            story.append(_p(escalation.message))
            if escalation.evidence:
                story.append(_p(escalation.evidence, MONO))
            story.append(Spacer(1, 6))

    story.append(_p("Edit history", H2))
    story.append(_history_table(report) if report.history else _p("No edits recorded for this case", SMALL))
    story += [Spacer(1, 14), _p(f"Generated {report.generated_at} by Logos. Case {report.email_id}.", SMALL)]

    doc.build(story)
    return buffer.getvalue()
