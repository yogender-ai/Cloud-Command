"""
Cloud Command — Premium Email Service
Beautiful dark-themed HTML emails for all notifications.
"""

import smtplib
import socket
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import settings

BRAND_COLOR = "#6366f1"
BRAND_GREEN = "#10b981"
BRAND_RED = "#f43f5e"
BRAND_AMBER = "#f59e0b"
APP_URL = "https://cloud-command.vercel.app"


def _mail_error_message(exc: Exception) -> str:
    if isinstance(exc, smtplib.SMTPAuthenticationError):
        return "Gmail rejected the SMTP login. Use a Gmail App Password and check SMTP_EMAIL/SMTP_PASSWORD."
    if isinstance(exc, (TimeoutError, socket.timeout)):
        return "Gmail SMTP timed out while sending the OTP. Retry once; if it keeps happening, check Render outbound network/logs."
    if isinstance(exc, OSError) and "timed out" in str(exc).lower():
        return "Gmail SMTP timed out while sending the OTP. Retry once; if it keeps happening, check Render outbound network/logs."
    return f"SMTP delivery failed: {exc}"


def get_last_mail_error() -> str:
    return getattr(_send_email, "last_error", "")


def _send_gmail_ssl(msg: MIMEMultipart):
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as server:
        server.login(settings.SMTP_EMAIL, settings.SMTP_PASSWORD)
        server.send_message(msg)


def _send_gmail_starttls(msg: MIMEMultipart):
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=30) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(settings.SMTP_EMAIL, settings.SMTP_PASSWORD)
        server.send_message(msg)


def _base_template(content: str, accent: str = BRAND_COLOR) -> str:
    """Shared premium dark HTML email wrapper."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Cloud Command</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body {{ margin:0; padding:0; background:#060608; font-family:'Inter',Arial,sans-serif; color:#e4e4f0; }}
    .wrapper {{ max-width:600px; margin:0 auto; background:#060608; }}
    .header {{ background:linear-gradient(135deg,{accent}22,{accent}11); border-bottom:1px solid {accent}33; padding:28px 36px; display:flex; align-items:center; gap:14px; }}
    .logo-box {{ width:44px;height:44px;background:linear-gradient(135deg,#6366f1,#a855f7);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#fff;font-family:monospace;flex-shrink:0; }}
    .brand-name {{ font-size:20px;font-weight:800;color:#f0f0f5;letter-spacing:-0.02em; }}
    .brand-sub {{ font-size:11px;color:#5a5a72;text-transform:uppercase;letter-spacing:0.12em;font-weight:600; }}
    .body {{ padding:36px; }}
    .footer {{ padding:24px 36px;border-top:1px solid #1a1a2e;text-align:center; }}
    .footer p {{ font-size:12px;color:#3a3a52;margin:4px 0; }}
    .footer a {{ color:#6366f1;text-decoration:none; }}
    .btn {{ display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-weight:700;font-size:14px;text-decoration:none;border-radius:10px;letter-spacing:0.01em; }}
    .card {{ background:#0d0d14;border:1px solid #1a1a2e;border-radius:14px;padding:24px;margin:20px 0; }}
    .label {{ font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#5a5a72;margin-bottom:4px; }}
    .value {{ font-size:15px;font-weight:600;color:#e4e4f0; }}
    .muted {{ color:#5a5a72;font-size:13px; }}
    a.link {{ color:{accent};text-decoration:none; }}
    h2 {{ font-size:24px;font-weight:800;color:#f0f0f5;margin:0 0 8px 0;letter-spacing:-0.02em; }}
    p {{ font-size:14px;line-height:1.7;color:#a0a0b8;margin:0 0 16px 0; }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo-box">&gt;_</div>
      <div>
        <div class="brand-name">Cloud Command</div>
        <div class="brand-sub">Secure DevOps Platform</div>
      </div>
    </div>
    <div class="body">
      {content}
    </div>
    <div class="footer">
      <p>Cloud Command &middot; Secure DevOps Platform</p>
      <p><a href="{APP_URL}">cloud-command.vercel.app</a> &middot; This is an automated message, do not reply.</p>
    </div>
  </div>
</body>
</html>"""


def _send_email(to: str, subject: str, html_body: str) -> bool:
    """Send an HTML email via SMTP."""
    if not settings.SMTP_EMAIL or not settings.SMTP_PASSWORD:
        _send_email.last_error = "SMTP_EMAIL or SMTP_PASSWORD is missing in the backend environment."
        print(f"[MAIL] Skipping — SMTP not configured. Would send to {to}: {subject}")
        return False

    msg = MIMEMultipart("alternative")
    msg["From"] = f"Cloud Command <{settings.SMTP_EMAIL}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    errors = []
    for label, sender in (("SSL 465", _send_gmail_ssl), ("STARTTLS 587", _send_gmail_starttls)):
        try:
            sender(msg)
            _send_email.last_error = ""
            print(f"[MAIL] Sent via {label} to {to}: {subject}")
            return True
        except Exception as e:
            errors.append(f"{label}: {_mail_error_message(e)}")
            print(f"[MAIL] Failed via {label} to {to}: {e}")

    _send_email.last_error = " | ".join(errors)
    return False

def send_otp_email(to: str, code: str, purpose: str = "verification") -> bool:
    """Send a premium OTP email for email verification or vault unlock."""
    purpose_label = "API Vault Unlock" if purpose == "vault" else "Email Verification"
    purpose_desc = (
        "Someone requested access to your API Vault. Enter this code to unlock it."
        if purpose == "vault"
        else "Use this code to verify your email address."
    )
    digits = "".join(
        f'<span style="display:inline-block;width:44px;height:56px;line-height:56px;text-align:center;background:#0d0d14;border:2px solid #6366f133;border-radius:10px;font-size:28px;font-weight:800;font-family:monospace;color:#f0f0f5;margin:0 4px;">{d}</span>'
        for d in code
    )
    content = f"""
    <h2>Your {purpose_label} Code</h2>
    <p>{purpose_desc}</p>
    <div style="text-align:center;margin:28px 0;">
      {digits}
    </div>
    <div class="card" style="border-color:#6366f133;background:#0a0a14;">
      <div style="display:flex;align-items:flex-start;gap:12px;">
        <span style="font-size:20px;">⏱️</span>
        <div>
          <div style="font-size:14px;font-weight:600;color:#e4e4f0;margin-bottom:4px;">Expires in 10 minutes</div>
          <div class="muted">This code is single-use and will expire automatically.</div>
        </div>
      </div>
    </div>
    <div class="card" style="border-color:#f43f5e22;background:#0d080a;">
      <div style="display:flex;align-items:flex-start;gap:12px;">
        <span style="font-size:20px;">🔒</span>
        <div>
          <div style="font-size:14px;font-weight:600;color:#f43f5e;margin-bottom:4px;">Didn't request this?</div>
          <div class="muted">If you didn't request this code, your account may be at risk. Change your password immediately.</div>
        </div>
      </div>
    </div>
    <p style="text-align:center;margin-top:24px;">
      <a href="{APP_URL}/settings" class="btn">Go to Settings</a>
    </p>
    """
    return _send_email(
        to=to,
        subject=f"🔐 Your Cloud Command code: {code}",
        html_body=_base_template(content, BRAND_COLOR),
    )


def send_status_change_email(to: str, site_name: str, site_url: str, new_status: str):
    """Send a premium alert when a monitored site changes status."""
    is_up = new_status == "UP"
    accent = BRAND_GREEN if is_up else BRAND_RED
    emoji = "✅" if is_up else "🔴"
    label = "Back Online" if is_up else "Down"
    desc = (
        "Good news! Your monitored site has recovered and is responding normally."
        if is_up
        else "Your monitored site is not responding. We'll keep checking and notify you when it recovers."
    )
    content = f"""
    <h2>{emoji} {site_name} is {label}</h2>
    <p>{desc}</p>
    <div class="card" style="border-left:4px solid {accent};border-color:{accent}44;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;">
        <div>
          <div class="label">Site</div>
          <div class="value">{site_name}</div>
        </div>
        <div>
          <div class="label">Status</div>
          <div style="font-size:15px;font-weight:700;color:{accent};">{"● ONLINE" if is_up else "● OFFLINE"}</div>
        </div>
      </div>
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid #1a1a2e;">
        <div class="label">URL</div>
        <a href="{site_url}" class="link" style="font-family:monospace;font-size:13px;">{site_url}</a>
      </div>
    </div>
    <p style="text-align:center;margin-top:24px;">
      <a href="{APP_URL}/monitors" class="btn">View Monitor Dashboard</a>
    </p>
    <p class="muted" style="text-align:center;margin-top:16px;">Cloud Command checks your sites automatically at your configured interval.</p>
    """
    _send_email(
        to=to,
        subject=f"{emoji} {site_name} is {label.upper()} — Cloud Command Alert",
        html_body=_base_template(content, accent),
    )


def send_monitor_action_email(to: str, action: str, url: str, interval: int = 60):
    """Send a notification when a monitor is added or deleted."""
    is_added = action == "added"
    emoji = "🚀" if is_added else "🗑️"
    accent = BRAND_GREEN if is_added else BRAND_AMBER
    title = "Monitor Deployed" if is_added else "Monitor Removed"
    desc = (
        f"Cloud Command is now watching <strong style='color:#e4e4f0;'>{url}</strong> and will alert you to any downtime."
        if is_added
        else f"The monitor for <strong style='color:#e4e4f0;'>{url}</strong> has been removed. You will no longer receive alerts for this site."
    )
    interval_label = f"{interval}s" if interval < 60 else f"{interval // 60}m"
    extra = f"""
    <div class="card" style="border-color:{accent}33;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div><div class="label">URL</div><div style="font-family:monospace;font-size:12px;color:#a0a0b8;word-break:break-all;">{url}</div></div>
        {"<div><div class='label'>Poll Interval</div><div class='value'>Every " + interval_label + "</div></div>" if is_added else ""}
      </div>
    </div>
    <p style="text-align:center;margin-top:24px;">
      <a href="{APP_URL}/monitors" class="btn">View Site Monitor</a>
    </p>
    """ if is_added else f"""
    <div class="card" style="border-color:{accent}33;">
      <div class="label">Removed URL</div>
      <div style="font-family:monospace;font-size:13px;color:#a0a0b8;">{url}</div>
    </div>
    """
    content = f"""
    <h2>{emoji} {title}</h2>
    <p>{desc}</p>
    {extra}
    """
    _send_email(
        to=to,
        subject=f"{emoji} Monitor {action}: {url}",
        html_body=_base_template(content, accent),
    )


def send_api_key_email(to: str, action: str, key_name: str, provider: str, masked_key: str):
    """Send a notification when an API key is added or deleted."""
    is_added = action == "added"
    emoji = "🔑" if is_added else "🗑️"
    accent = BRAND_COLOR if is_added else BRAND_RED
    title = "API Key Added" if is_added else "API Key Deleted"
    desc = (
        f"A new API key has been stored in your Cloud Command vault. It is encrypted with AES-256 and never exposed in plaintext."
        if is_added
        else f"The API key <strong style='color:#e4e4f0;'>{key_name}</strong> has been permanently deleted from your vault."
    )
    content = f"""
    <h2>{emoji} {title}</h2>
    <p>{desc}</p>
    <div class="card" style="border-color:{accent}33;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div><div class="label">Key Name</div><div class="value">{key_name}</div></div>
        <div><div class="label">Provider</div><div class="value">{provider}</div></div>
      </div>
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid #1a1a2e;">
        <div class="label">Masked Key</div>
        <div style="font-family:monospace;font-size:14px;color:#a0a0b8;letter-spacing:0.05em;">{masked_key}</div>
      </div>
    </div>
    {"<div class='card' style='border-color:#f43f5e22;background:#0d080a;'><div style='display:flex;align-items:flex-start;gap:12px;'><span style='font-size:20px;'>🛡️</span><div><div style='font-size:14px;font-weight:600;color:#e4e4f0;margin-bottom:4px;'>Security Notice</div><div class='muted'>If you did not perform this action, someone may have unauthorized access to your account. Change your password immediately.</div></div></div></div>" if is_added else ""}
    <p style="text-align:center;margin-top:24px;">
      <a href="{APP_URL}/api-keys" class="btn">View API Vault</a>
    </p>
    """
    _send_email(
        to=to,
        subject=f"{emoji} {title}: {key_name} ({provider})",
        html_body=_base_template(content, accent),
    )
