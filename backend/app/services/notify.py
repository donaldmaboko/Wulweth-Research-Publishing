"""Notification + email dispatch.

Emails are delivered through EmailService (SMTP in production; in development
every message is persisted to email_log and printed to the API log so the
whole flow is observable without external services). Send operations are
enqueued as background tasks — see README (Background processing) for the
production queue design.
"""
from __future__ import annotations

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import EmailLog, Notification, User
from app.models_enums import NotificationType


def send_email(db: Session, to_email: str, subject: str, body: str, template: str | None = None) -> None:
    if settings.smtp_host:
        try:  # pragma: no cover - exercised only in production SMTP setups
            import smtplib
            from email.mime.text import MIMEText

            msg = MIMEText(body, "plain")
            msg["Subject"] = subject
            msg["From"] = settings.email_from
            msg["To"] = to_email
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                if settings.smtp_user:
                    server.starttls()
                    server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
            status = "SENT"
        except Exception as exc:  # pragma: no cover
            print(f"[email] delivery failed to {to_email}: {exc}")
            status = "FAILED"
    else:
        status = "LOGGED"
        print(f"[email] to={to_email} subject={subject!r}")
    db.add(EmailLog(to_email=to_email, subject=subject, body=body, template=template, status=status))


def notify(
    db: Session,
    background: BackgroundTasks | None,
    user: User,
    ntype: NotificationType | str,
    title: str,
    body: str | None = None,
    link: str | None = None,
    email_subject: str | None = None,
    email_body: str | None = None,
) -> None:
    prefs = user.notification_prefs or {}
    category = str(ntype.value if isinstance(ntype, NotificationType) else ntype)
    db.add(Notification(user_id=user.id, type=category, title=title, body=body, link=link))
    wants_email = prefs.get(category, {}).get("email", True) if isinstance(prefs.get(category), dict) else True
    if wants_email and user.email:
        send_email(db, user.email, email_subject or title, email_body or body or "", template=category.lower())
