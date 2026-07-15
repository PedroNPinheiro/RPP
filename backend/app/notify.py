"""Email notifications — Office 365 SMTP (STARTTLS).

Sending runs as a FastAPI background task after the response is out, and
never raises into the request: a mail outage must not break saving a line.
"""
import logging
import smtplib
from email.message import EmailMessage

from .config import settings

log = logging.getLogger("rpp")


def drawings_notify_enabled() -> bool:
    return bool(settings.smtp_user and settings.smtp_password and settings.notify_drawings_to)


def _fmt(v) -> str:
    return "—" if v is None or v == "" else str(v)


def _line_block(row: dict) -> str:
    return "\n".join(
        [
            f"PO:            {row['poh_num']}  (line {row['poh_line']})",
            f"Item:          {_fmt(row.get('item_code'))} — {_fmt(row.get('item_desc'))}",
            f"Qty / Balance: {_fmt(row.get('qty_ordered'))} / {_fmt(row.get('balance_qty'))}",
            f"Supplier:      {_fmt(row.get('supplier_name'))}",
            f"Expected:      {_fmt(row.get('expected_receipt'))}",
            f"Status:        {_fmt(row.get('status'))}   Priority: {_fmt(row.get('priority'))}",
            f"Área:          {_fmt(row.get('area'))}   Category: {_fmt(row.get('category'))}",
            f"OF: {_fmt(row.get('of_number'))}   PC: {_fmt(row.get('pc_number'))}",
            f"Drawings desc: {_fmt(row.get('drawings_desc'))}",
            f"Notes:         {_fmt(row.get('notes'))}",
        ]
    )


def send_drawings_notification(rows: list[dict], changed_by: str) -> None:
    """One email covering every line whose 'Drawings?' box was just ticked."""
    try:
        if len(rows) == 1:
            subject = f"Drawings required: {rows[0]['poh_num']} · {rows[0].get('item_code', '')}"
        else:
            subject = f"Drawings required: {len(rows)} lines"

        blocks = "\n\n----------------------------------------\n\n".join(
            _line_block(r) for r in rows
        )
        body = (
            f"The 'Drawings required' box was ticked by {changed_by}.\n\n"
            f"{blocks}\n\n"
            f"Open the dashboard: {settings.app_base_url}\n"
        )

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = settings.smtp_user
        msg["To"] = ", ".join(a.strip() for a in settings.notify_drawings_to.split(",") if a.strip())
        if settings.notify_drawings_bcc:
            # smtplib.send_message adds Bcc to the envelope but strips the
            # header, so recipients never see the copy
            msg["Bcc"] = ", ".join(
                a.strip() for a in settings.notify_drawings_bcc.split(",") if a.strip()
            )
        msg.set_content(body)

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as s:
            s.starttls()
            s.login(settings.smtp_user, settings.smtp_password)
            s.send_message(msg)
        log.info("drawings notification sent for %d line(s)", len(rows))
    except Exception:
        log.exception("drawings notification failed")
