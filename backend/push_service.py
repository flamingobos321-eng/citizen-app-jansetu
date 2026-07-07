"""JanSetu push notification service.

**Delivery adapters:**
  * FCM (Firebase Cloud Messaging) — for both Android + web push
  * DEV — logs to stdout when no credentials configured

**Configuration (backend/.env):**
  * ``FCM_SERVICE_ACCOUNT_JSON`` — file path to Firebase service account JSON,
    OR raw JSON string.  Optional.  When missing, we fall back to DEV mode so
    the app continues to work in development without needing a Firebase project.

The device-token registration + notification-persistence layers live in
``server.py``.  This module owns *only* delivery.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Iterable, List, Optional

logger = logging.getLogger("jansetu.push")


@dataclass
class PushMessage:
    title: str
    body: str
    data: Optional[dict] = None
    click_action: Optional[str] = None


class _NoopAdapter:
    """DEV mode — logs the notification but doesn't deliver it."""

    name = "development"

    def send(self, tokens: List[str], msg: PushMessage) -> dict:  # noqa: D401
        logger.info(
            "[push:dev] would deliver title=%r body=%r to %d device(s)",
            msg.title, msg.body, len(tokens),
        )
        return {"success": len(tokens), "failure": 0, "invalid_tokens": []}


class _FCMAdapter:
    """Firebase Cloud Messaging adapter (works for Android + Web + iOS)."""

    name = "fcm"

    def __init__(self, service_account_source: str):
        import firebase_admin
        from firebase_admin import credentials as _cred

        # ``service_account_source`` may be a file path OR the raw JSON string.
        if service_account_source.strip().startswith("{"):
            cred_dict = json.loads(service_account_source)
            cred = _cred.Certificate(cred_dict)
        else:
            cred = _cred.Certificate(service_account_source)

        if not firebase_admin._apps:  # idempotent init
            firebase_admin.initialize_app(cred)

    def send(self, tokens: List[str], msg: PushMessage) -> dict:
        from firebase_admin import messaging as fcm

        if not tokens:
            return {"success": 0, "failure": 0, "invalid_tokens": []}

        # Deduplicate to protect against duplicate registrations.
        tokens = list(dict.fromkeys(tokens))

        msg_obj = fcm.MulticastMessage(
            tokens=tokens,
            notification=fcm.Notification(title=msg.title, body=msg.body),
            data={k: str(v) for k, v in (msg.data or {}).items()} or None,
            android=fcm.AndroidConfig(
                priority="high",
                notification=fcm.AndroidNotification(
                    click_action=msg.click_action,
                    channel_id="jansetu_default",
                ),
            ),
            webpush=fcm.WebpushConfig(
                fcm_options=fcm.WebpushFCMOptions(link=msg.click_action or "/"),
            ),
        )
        resp = fcm.send_each_for_multicast(msg_obj)
        invalid_tokens: List[str] = []
        for idx, r in enumerate(resp.responses):
            if r.success:
                continue
            err = getattr(r.exception, "code", "unknown")
            # Treat token as invalid so caller can prune it.
            if err in ("registration-token-not-registered", "invalid-argument", "invalid-registration-token"):
                invalid_tokens.append(tokens[idx])
        return {
            "success": resp.success_count,
            "failure": resp.failure_count,
            "invalid_tokens": invalid_tokens,
        }


# ---------------------------------------------------------------------------
# Singleton entry point
# ---------------------------------------------------------------------------
_adapter = None


def get_adapter():
    global _adapter
    if _adapter is not None:
        return _adapter

    src = os.environ.get("FCM_SERVICE_ACCOUNT_JSON") or os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if src:
        try:
            _adapter = _FCMAdapter(src)
            logger.info("Push notifications: FCM adapter initialised")
        except Exception as e:
            logger.warning("FCM init failed (%s) — falling back to DEV adapter", e)
            _adapter = _NoopAdapter()
    else:
        logger.info("Push notifications: DEV adapter (set FCM_SERVICE_ACCOUNT_JSON to enable delivery)")
        _adapter = _NoopAdapter()
    return _adapter


def send(tokens: Iterable[str], title: str, body: str,
         data: Optional[dict] = None, click_action: Optional[str] = None) -> dict:
    """Send a push notification to N device tokens. Returns delivery stats."""
    msg = PushMessage(title=title, body=body, data=data, click_action=click_action)
    return get_adapter().send(list(tokens), msg)


def current_mode() -> str:
    return get_adapter().name
