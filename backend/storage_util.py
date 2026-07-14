"""S3-compatible object storage helper (boto3)."""
import os
import logging
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

APP_NAME = os.environ.get("APP_NAME", "jansetu")

S3_BUCKET = os.environ.get("S3_BUCKET_NAME", "")
S3_REGION = os.environ.get("AWS_REGION", "us-east-1")

_s3_client = None


def _get_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            region_name=S3_REGION,
            aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
            # Set S3_ENDPOINT_URL for MinIO or other S3-compatible stores
            endpoint_url=os.environ.get("S3_ENDPOINT_URL") or None,
        )
    return _s3_client


def init_storage():
    """Verify bucket is reachable; returns bucket name or None if not configured."""
    if not S3_BUCKET:
        logger.warning("S3_BUCKET_NAME not set — file storage disabled")
        return None
    try:
        _get_client().head_bucket(Bucket=S3_BUCKET)
        logger.info("Object storage (S3) ready: bucket=%s", S3_BUCKET)
        return S3_BUCKET
    except ClientError as exc:
        logger.warning("Storage init deferred: %s", exc)
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    if not S3_BUCKET:
        raise RuntimeError("S3_BUCKET_NAME is not configured — cannot store files")
    _get_client().put_object(
        Bucket=S3_BUCKET,
        Key=path,
        Body=data,
        ContentType=content_type,
    )
    return {"path": path}


def get_object(path: str):
    if not S3_BUCKET:
        raise RuntimeError("S3_BUCKET_NAME is not configured — cannot retrieve files")
    resp = _get_client().get_object(Bucket=S3_BUCKET, Key=path)
    return resp["Body"].read(), resp["ContentType"]
