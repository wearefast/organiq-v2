"""PDF Report Generation Router"""

import io
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm, inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    HRFlowable,
)

router = APIRouter()


# ─── Request Models ───────────────────────────────────────────


class ReportSection(BaseModel):
    title: str
    content: str
    level: int = Field(default=2, ge=1, le=4)


class ReportRequest(BaseModel):
    title: str
    project_domain: str
    report_type: str
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    sections: list[ReportSection]
    metadata: dict = Field(default_factory=dict)


class ReportResponse(BaseModel):
    pdf_base64: str
    page_count: int
    file_size_bytes: int


# ─── Styles ───────────────────────────────────────────────────

_BRAND_COLOR = colors.HexColor("#E11D48")  # Rose-600
_DARK_TEXT = colors.HexColor("#18181B")  # Zinc-900
_MUTED_TEXT = colors.HexColor("#71717A")  # Zinc-500
_BORDER_COLOR = colors.HexColor("#E4E4E7")  # Zinc-200


def _build_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontSize=24,
        leading=30,
        textColor=_DARK_TEXT,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=_MUTED_TEXT,
        spaceAfter=20,
    ))
    styles.add(ParagraphStyle(
        "SectionH1",
        parent=styles["Heading1"],
        fontSize=18,
        leading=24,
        textColor=_DARK_TEXT,
        spaceBefore=20,
        spaceAfter=10,
        borderColor=_BRAND_COLOR,
        borderWidth=2,
        borderPadding=(0, 0, 4, 0),
    ))
    styles.add(ParagraphStyle(
        "SectionH2",
        parent=styles["Heading2"],
        fontSize=14,
        leading=18,
        textColor=_DARK_TEXT,
        spaceBefore=14,
        spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        "SectionH3",
        parent=styles["Heading3"],
        fontSize=12,
        leading=16,
        textColor=_DARK_TEXT,
        spaceBefore=10,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        "BodyText",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=_DARK_TEXT,
        spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.white,
        alignment=TA_LEFT,
    ))
    styles.add(ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=_DARK_TEXT,
    ))
    styles.add(ParagraphStyle(
        "Footer",
        parent=styles["Normal"],
        fontSize=8,
        textColor=_MUTED_TEXT,
        alignment=TA_CENTER,
    ))

    return styles


# ─── Markdown → Flowables Parser ─────────────────────────────


def _parse_markdown_content(text: str, styles) -> list:
    """Convert simplified markdown content into ReportLab flowables."""
    flowables = []
    lines = text.strip().split("\n")
    i = 0

    while i < len(lines):
        line = lines[i].strip()

        # Skip empty lines
        if not line:
            i += 1
            continue

        # Horizontal rule
        if line in ("---", "***", "___"):
            flowables.append(Spacer(1, 4 * mm))
            flowables.append(HRFlowable(
                width="100%", thickness=0.5, color=_BORDER_COLOR,
                spaceAfter=4 * mm, spaceBefore=2 * mm,
            ))
            i += 1
            continue

        # Table (pipes)
        if "|" in line and line.startswith("|"):
            table_lines = []
            while i < len(lines) and "|" in lines[i].strip() and lines[i].strip().startswith("|"):
                raw = lines[i].strip()
                # Skip separator rows (|---|---|)
                if re.match(r"^\|[\s\-:|]+\|$", raw):
                    i += 1
                    continue
                cells = [c.strip() for c in raw.split("|")[1:-1]]
                table_lines.append(cells)
                i += 1

            if table_lines:
                flowables.append(_build_table(table_lines, styles))
                flowables.append(Spacer(1, 4 * mm))
            continue

        # Bullet list
        if line.startswith("- ") or line.startswith("* "):
            bullet_text = line[2:]
            flowables.append(Paragraph(
                f"• {_escape_html(bullet_text)}",
                styles["BodyText"],
            ))
            i += 1
            continue

        # Numbered list
        num_match = re.match(r"^(\d+)\.\s+(.*)", line)
        if num_match:
            flowables.append(Paragraph(
                f"{num_match.group(1)}. {_escape_html(num_match.group(2))}",
                styles["BodyText"],
            ))
            i += 1
            continue

        # Bold text handling within paragraphs
        formatted = _escape_html(line)
        formatted = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", formatted)

        flowables.append(Paragraph(formatted, styles["BodyText"]))
        i += 1

    return flowables


def _escape_html(text: str) -> str:
    """Escape HTML special chars for ReportLab Paragraph."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _build_table(rows: list[list[str]], styles) -> Table:
    """Build a styled table from parsed markdown rows."""
    if not rows:
        return Spacer(1, 0)

    # Convert cells to Paragraphs
    header_row = [Paragraph(_escape_html(c), styles["TableHeader"]) for c in rows[0]]
    data_rows = [
        [Paragraph(_escape_html(c), styles["TableCell"]) for c in row]
        for row in rows[1:]
    ]

    table_data = [header_row] + data_rows
    col_count = len(rows[0])

    # Equal column widths
    available = A4[0] - 2 * inch
    col_widths = [available / col_count] * col_count

    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), _BRAND_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
        ("TOPPADDING", (0, 1), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, _BORDER_COLOR),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFAFA")]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return table


# ─── PDF Builder ──────────────────────────────────────────────


def _add_page_number(canvas, doc):
    """Footer callback: page number + branding."""
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(_MUTED_TEXT)
    canvas.drawCentredString(
        A4[0] / 2,
        15 * mm,
        f"Page {doc.page} — Generated by Pulse OS",
    )
    canvas.restoreState()


def _generate_pdf(report: ReportRequest, styles) -> tuple[bytes, int]:
    """Generate PDF bytes from a report request. Returns (pdf_bytes, page_count)."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=25 * mm,
        bottomMargin=25 * mm,
        leftMargin=25 * mm,
        rightMargin=25 * mm,
    )

    flowables = []

    # Title page
    flowables.append(Spacer(1, 40 * mm))
    flowables.append(Paragraph(report.title, styles["ReportTitle"]))
    flowables.append(Paragraph(
        f"{report.project_domain} · {report.report_type.replace('_', ' ').title()}",
        styles["ReportSubtitle"],
    ))
    flowables.append(Paragraph(
        f"Generated: {report.generated_at[:10]}",
        styles["ReportSubtitle"],
    ))
    flowables.append(Spacer(1, 10 * mm))
    flowables.append(HRFlowable(
        width="40%", thickness=2, color=_BRAND_COLOR,
        spaceAfter=10 * mm,
    ))

    # Metadata table if present
    if report.metadata:
        meta_rows = [[k.replace("_", " ").title(), str(v)] for k, v in report.metadata.items() if v]
        if meta_rows:
            meta_rows.insert(0, ["Property", "Value"])
            flowables.append(_build_table(meta_rows, styles))
            flowables.append(Spacer(1, 6 * mm))

    flowables.append(PageBreak())

    # Sections
    heading_styles = {
        1: "SectionH1",
        2: "SectionH2",
        3: "SectionH3",
        4: "SectionH3",
    }

    for section in report.sections:
        style_name = heading_styles.get(section.level, "SectionH2")
        flowables.append(Paragraph(
            _escape_html(section.title),
            styles[style_name],
        ))

        content_flowables = _parse_markdown_content(section.content, styles)
        flowables.extend(content_flowables)

        flowables.append(Spacer(1, 4 * mm))

    # Build
    doc.build(flowables, onFirstPage=_add_page_number, onLaterPages=_add_page_number)

    pdf_bytes = buffer.getvalue()
    buffer.close()

    # Count pages (approximate from ReportLab)
    page_count = pdf_bytes.count(b"/Type /Page") - pdf_bytes.count(b"/Type /Pages")
    if page_count < 1:
        page_count = 1

    return pdf_bytes, page_count


# ─── Endpoint ─────────────────────────────────────────────────


@router.post("/pdf", response_model=ReportResponse)
async def generate_pdf(report: ReportRequest):
    """Generate a PDF report from structured sections.

    Accepts a title, sections (with markdown content), and metadata.
    Returns base64-encoded PDF bytes.
    """
    import base64

    styles = _build_styles()
    pdf_bytes, page_count = _generate_pdf(report, styles)

    return ReportResponse(
        pdf_base64=base64.b64encode(pdf_bytes).decode("ascii"),
        page_count=page_count,
        file_size_bytes=len(pdf_bytes),
    )
