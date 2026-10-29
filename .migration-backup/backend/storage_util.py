"""S3-compatible object storage helper (boto3) + local filesystem fallback.

Storage backend selection (checked in order):
  1. S3 / S3-compatible store  — when AWS_ACCESS_KEY_ID + S3_BUCKET_NAME are set.
  2. Local filesystem          — when LOCAL_STORAGE_PATH is set (or always as a
                                 safe default when S3 creds are absent).

Set LOCAL_STORAGE_PATH to an absolute directory on the VPS (e.g. /var/data/jansetu/uploads).
Leave S3 env vars unset to stay on local storage; populate them whenever you migrate to S3.
"""
import os
import logging
import mimetypes
from pathlib import Path

logger = logging.getLogger(__name__)

APP_NAME = os.environ.get("APP_NAME", "jansetu")

# ── S3 config (kept for future use) ──────────────────────────────────────────
S3_BUCKET = os.environ.get("S3_BUCKET_NAME", "")
S3_REGION = os.environ.get("AWS_REGION", "us-east-1")

_s3_client = None


def _get_s3_client():
    """Lazy-init boto3 client. Only called when S3 creds are present."""
    global _s3_client
    if _s3_client is None:
        import boto3  # deferred so the module loads without boto3 issues
        _s3_client = boto3.client(
            "s3",
            region_name=S3_REGION,
            aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
            # Set S3_ENDPOINT_URL for MinIO or other S3-compatible stores
            endpoint_url=os.environ.get("S3_ENDPOINT_URL") or None,
        )
    return _s3_client


# ── Local filesystem config ───────────────────────────────────────────────────
# Defaults to an "uploads" directory next to this file when not explicitly set.
_DEFAULT_LOCAL_PATH = str(Path(__file__).parent / "uploads")
LOCAL_STORAGE_PATH = os.environ.get("LOCAL_STORAGE_PATH", _DEFAULT_LOCAL_PATH)


def _local_file_path(path: str) -> Path:
    """Resolve a storage key to an absolute local path, preventing path traversal."""
    root = Path(LOCAL_STORAGE_PATH).resolve()
    target = (root / path).resolve()
    if not str(target).startswith(str(root)):
        raise ValueError(f"Path traversal detected: {path!r}")
    return target


# ── Backend selection ─────────────────────────────────────────────────────────

def _use_s3() -> bool:
    """Return True only when both S3 bucket name and credentials are configured."""
    return bool(
        S3_BUCKET
        and os.environ.get("AWS_ACCESS_KEY_ID")
        and os.environ.get("AWS_SECRET_ACCESS_KEY")
    )


# ── Public API ────────────────────────────────────────────────────────────────

def init_storage():
    """Verify storage is reachable; returns backend name or None if not configured.

    Returns:
        "s3"    — S3 bucket reachable.
        "local" — local filesystem directory ready.
        None    — storage could not be initialised (should not happen with defaults).
    """
    if _use_s3():
        try:
            from botocore.exceptions import ClientError
            _get_s3_client().head_bucket(Bucket=S3_BUCKET)
            logger.info("Object storage (S3) ready: bucket=%s", S3_BUCKET)
            return "s3"
        except Exception as exc:
            logger.warning("S3 storage init failed (%s) — falling back to local filesystem", exc)

    # Local filesystem (default for VPS deployments)
    try:
        local_root = Path(LOCAL_STORAGE_PATH)
        local_root.mkdir(parents=True, exist_ok=True)
        logger.info("Object storage (local filesystem) ready: path=%s", LOCAL_STORAGE_PATH)
        return "local"
    except Exception as exc:
        logger.warning("Local storage init failed: %s", exc)
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Write bytes to storage. Returns {"path": path}."""
    if _use_s3():
        _get_s3_client().put_object(
            Bucket=S3_BUCKET,
            Key=path,
            Body=data,
            ContentType=content_type,
        )
        return {"path": path}

    # Local filesystem
    dest = _local_file_path(path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    logger.debug("Stored file locally: %s (%d bytes)", dest, len(data))
    return {"path": path}


def get_object(path: str):
    """Read bytes from storage. Returns (data: bytes, content_type: str)."""
    if _use_s3():
        resp = _get_s3_client().get_object(Bucket=S3_BUCKET, Key=path)
        return resp["Body"].read(), resp["ContentType"]

    # Local filesystem
    src = _local_file_path(path)
    if not src.exists():
        raise FileNotFoundError(f"File not found in local storage: {path!r}")
    data = src.read_bytes()
    # Best-effort content-type from extension
    ctype, _ = mimetypes.guess_type(str(src))
    return data, ctype or "application/octet-stream"
