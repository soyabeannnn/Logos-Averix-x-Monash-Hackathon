"""Downloadable case reports. Add a format by writing a renderer and registering it in FORMATS."""
from dataclasses import dataclass
from typing import Callable

from .model import Report, build_report
from .pdf import render_pdf
from .word import render_word


@dataclass(frozen=True)
class Format:
    extension: str
    mime: str
    render: Callable[[Report], bytes]


FORMATS = {
    "pdf": Format("pdf", "application/pdf", render_pdf),
    "docx": Format(
        "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", render_word),
}

__all__ = ["FORMATS", "Format", "Report", "build_report"]
