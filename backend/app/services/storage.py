import boto3
import uuid
from app.config import get_settings

settings = get_settings()

s3_client = None

def _get_s3_client():
    global s3_client
    if s3_client is None:
        if not settings.r2_endpoint:
            raise RuntimeError("R2 storage is not configured. Set R2_ENDPOINT and related env vars.")
        s3_client = boto3.client(
            "s3",
            endpoint_url=settings.r2_endpoint,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name="auto"
        )
    return s3_client


def upload_image(file_bytes: bytes, filename: str, mimetype: str) -> dict:
    """Upload image to R2, return the key and URL."""
    
    # generate unique name
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"
    key = f"notes/{uuid.uuid4()}.{ext}"
    
    _get_s3_client().put_object(
        Bucket=settings.r2_bucket_name,
        Key=key,
        Body=file_bytes,
        ContentType=mimetype,
    )
    
    # generate a presigned url
    # (or make the bucket public and use a direct URL instead)
    url = _get_s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.r2_bucket_name, "Key": key},
        ExpiresIn=604800  # 7 days in seconds
    )
    
    return {"key": key, "url": url}


def delete_image(key: str) -> None:
    """Delete an image from R2 by its key."""
    _get_s3_client().delete_object(
        Bucket=settings.r2_bucket_name,
        Key=key
    )


def get_fresh_url(key: str) -> str:
    """Generate a fresh presigned URL for an existing key."""
    return _get_s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.r2_bucket_name, "Key": key},
        ExpiresIn=604800
    )