"""
Email notification service using SMTP (Gmail).
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import settings


def _send_email(to: str, subject: str, html_body: str):
    """Send an HTML email via SMTP."""
    if not settings.SMTP_EMAIL or not settings.SMTP_PASSWORD:
        print(f"[MAIL] Skipping — SMTP not configured. Would send to {to}: {subject}")
        return

    msg = MIMEMultipart("alternative")
    msg["From"] = f"Cloud Command <{settings.SMTP_EMAIL}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(settings.SMTP_EMAIL, settings.SMTP_PASSWORD)
            server.send_message(msg)
        print(f"[MAIL] Sent to {to}: {subject}")
    except Exception as e:
        print(f"[MAIL] Failed to send to {to}: {e}")


def send_otp_email(to: str, code: str):
    """Send an OTP verification email."""
    _send_email(
        to=to,
        subject=f"Cloud Command — Your verification code: {code}",
        html_body=f"""
        <div style="font-family: 'Inter', sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="color: #10b981; margin-bottom: 8px;">Cloud Command</h2>
            <p style="color: #71717a;">Your verification code is:</p>
            <div style="background: #18181b; color: #fff; font-size: 32px; letter-spacing: 8px; padding: 20px; border-radius: 12px; text-align: center; font-family: monospace; margin: 20px 0;">
                {code}
            </div>
            <p style="color: #a1a1aa; font-size: 12px;">This code expires in 10 minutes.</p>
        </div>
        """,
    )


def send_status_change_email(to: str, site_name: str, site_url: str, new_status: str):
    """Send an alert when a monitored site changes status."""
    is_up = new_status == "UP"
    color = "#10b981" if is_up else "#ef4444"
    emoji = "✅" if is_up else "🔴"
    label = "BACK ONLINE" if is_up else "DOWN"

    _send_email(
        to=to,
        subject=f"{emoji} {site_name} is {label}",
        html_body=f"""
        <div style="font-family: 'Inter', sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="color: #10b981; margin-bottom: 24px;">Cloud Command Alert</h2>
            <div style="background: #18181b; border-radius: 16px; padding: 24px; border-left: 4px solid {color};">
                <h3 style="color: #fff; margin: 0 0 8px 0;">{emoji} {site_name} is {label}</h3>
                <p style="color: #a1a1aa; margin: 0; font-size: 14px;">{site_url}</p>
            </div>
            <p style="color: #71717a; font-size: 12px; margin-top: 24px;">— Cloud Command Monitoring</p>
        </div>
        """,
    )


def send_monitor_action_email(to: str, action: str, url: str):
    """Send a notification when a monitor is added or deleted."""
    emoji = "➕" if action == "added" else "🗑️"
    _send_email(
        to=to,
        subject=f"{emoji} Monitor {action}: {url}",
        html_body=f"""
        <div style="font-family: 'Inter', sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="color: #10b981;">Cloud Command</h2>
            <p style="color: #e4e4e7;">A monitor has been <strong>{action}</strong>:</p>
            <p style="color: #a1a1aa; font-family: monospace;">{url}</p>
        </div>
        """,
    )
