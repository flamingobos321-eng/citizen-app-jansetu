"""OTP communication service.

Deliberately isolated from server.py so future channels (WhatsApp / Email /
another SMS gateway) can be added by dropping in a new provider function —
without touching the request/verify business logic.

Contract:
    - `generate_otp()`            → secure random 6-digit string.
    - `send_otp(mobile, otp, cfg)`→ dispatches based on cfg["provider"].
                                    Returns {"delivered": bool, "provider": str,
                                    "reason": Optional[str], "raw": Optional[dict]}.
                                    Never raises — SMS failure is a soft failure so
                                    the OTP endpoint stays deterministic. Errors are
                                    surfaced as `delivered=False` with a reason
                                    string suitable for the audit log.

Callers (server.py) resolve the tenant, read `portal_configs.communication_mode`
and `portal_configs.otp_config`, then invoke this module. In development mode
the caller shortcuts to fixed OTP "123456" and never touches this file.
"""
from __future__ import annotations

import logging
import secrets
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

FIXED_DEV_OTP = "123456"
DEFAULT_ROUTE = "dlt"

# Fast2SMS DLT bulk endpoint.
_FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2"


def generate_otp(digits: int = 6) -> str:
    """Cryptographically secure random OTP as a zero-padded string."""
    upper = 10 ** digits
    return str(secrets.randbelow(upper)).zfill(digits)


async def _send_via_fast2sms(mobile: str, otp: str, cfg: dict) -> dict:
    """Deliver OTP via Fast2SMS DLT route.

    Fast2SMS DLT contract (from their bulkV2 docs):
        POST https://www.fast2sms.com/dev/bulkV2
        Headers: authorization: <API_KEY>
        Body (form):
            route             = dlt
            sender_id         = <6-char sender>
            message           = <DLT template / message id>
            variables_values  = <OTP value>
            numbers           = <10-digit mobile, comma-separated for bulk>
            flash             = 0
    """
    api_key = (cfg.get("api_key") or "").strip()
    sender_id = (cfg.get("sender_id") or "").strip()
    message_id = (cfg.get("message_id") or "").strip()
    route = (cfg.get("route") or DEFAULT_ROUTE).strip()
    if not api_key or not sender_id or not message_id:
        return {
            "delivered": False, "provider": "fast2sms",
            "reason": "Missing api_key, sender_id or message_id on tenant OTP config.",
            "raw": None,
        }
    payload = {
        "route": route,
        "sender_id": sender_id,
        "message": message_id,
        "variables_values": otp,
        "flash": "0",
        "numbers": mobile,
    }
    headers = {"authorization": api_key, "cache-control": "no-cache"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(_FAST2SMS_URL, data=payload, headers=headers)
        raw: Optional[dict]
        try:
            raw = resp.json()
        except Exception:
            raw = {"text": resp.text[:500]}
        ok = bool(resp.status_code == 200 and isinstance(raw, dict) and raw.get("return") is True)
        return {
            "delivered": ok, "provider": "fast2sms",
            "reason": None if ok else (raw.get("message") if isinstance(raw, dict) else f"HTTP {resp.status_code}"),
            "raw": raw,
        }
    except httpx.HTTPError as e:
        logger.warning("Fast2SMS network error: %s", e)
        return {"delivered": False, "provider": "fast2sms",
                "reason": f"network_error: {e.__class__.__name__}", "raw": None}


async def send_otp(mobile: str, otp: str, otp_config: dict) -> dict:
    """Dispatch to the configured provider. Never raises."""
    provider = (otp_config.get("provider") or "").strip().lower()
    if provider == "fast2sms":
        return await _send_via_fast2sms(mobile, otp, otp_config)
    return {"delivered": False, "provider": provider or "unknown",
            "reason": "Unsupported or missing provider on tenant OTP config.",
            "raw": None}
