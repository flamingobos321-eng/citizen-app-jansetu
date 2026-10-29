"""JanSetu push notification service.

**Delivery adapters:**
  * Expo Push Service — native Expo notifications
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
import urllib.error
import urllib.request
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

        # WebpushFCMOptions.link REQUIRES an absolute https:// URL — turn
        # relative click_actions like "/app/notifications" into full URLs
        # anchored on the deployment's public origin.
        webpush_link = None
        if msg.click_action:
            if msg.click_action.startswith("http://") or msg.click_action.startswith("https://"):
                webpush_link = msg.click_action
            else:
                origin = os.environ.get("PUBLIC_APP_URL") or os.environ.get("REACT_APP_BACKEND_URL") or "https://jansetu.in"
                webpush_link = origin.rstrip("/") + ("/" + msg.click_action.lstrip("/"))

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
                fcm_options=fcm.WebpushFCMOptions(link=webpush_link) if webpush_link else None,
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
    """Send FCM and Expo push tokens through their respective gateways."""
    msg = PushMessage(title=title, body=body, data=data, click_action=click_action)
    unique_tokens = list(dict.fromkeys(tokens))
    expo_tokens = [token for token in unique_tokens if token.startswith(("ExpoPushToken[", "ExponentPushToken["))]
    fcm_tokens = [token for token in unique_tokens if token not in expo_tokens]
    expo_result = _send_expo(expo_tokens, msg) if expo_tokens else {
        "success": 0, "failure": 0, "invalid_tokens": [],
    }
    fcm_result = get_adapter().send(fcm_tokens, msg) if fcm_tokens else {
        "success": 0, "failure": 0, "invalid_tokens": [],
    }
    return {
        "success": expo_result["success"] + fcm_result["success"],
        "failure": expo_result["failure"] + fcm_result["failure"],
        "invalid_tokens": expo_result["invalid_tokens"] + fcm_result["invalid_tokens"],
    }


def _send_expo(tokens: List[str], msg: PushMessage) -> dict:
    """Deliver ExpoPushTokens through Expo's push service in batches of 100."""
    success = 0
    failure = 0
    invalid_tokens: List[str] = []
    data = dict(msg.data or {})
    if msg.click_action:
        data.setdefault("click_action", msg.click_action)

    for start in range(0, len(tokens), 100):
        batch = tokens[start:start + 100]
        messages = [
            {
                "to": token,
                "title": msg.title,
                "body": msg.body,
                "sound": "default",
                "priority": "high",
                "channelId": "jansetu_default",
                "data": data,
            }
            for token in batch
        ]
        request = urllib.request.Request(
            "https://exp.host/--/api/v2/push/send",
            data=json.dumps(messages).encode("utf-8"),
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                result = json.loads(response.read().decode("utf-8"))
            tickets = result.get("data", [])
            for index, token in enumerate(batch):
                ticket = tickets[index] if index < len(tickets) else {}
                if ticket.get("status") == "ok":
                    success += 1
                else:
                    failure += 1
                    details = ticket.get("details") or {}
                    if details.get("error") == "DeviceNotRegistered":
                        invalid_tokens.append(token)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            logger.warning("Expo push request failed for %d device(s): %s", len(batch), error)
            failure += len(batch)

    return {"success": success, "failure": failure, "invalid_tokens": invalid_tokens}


def current_mode() -> str:
    return get_adapter().name
