import hashlib
import hmac
import re
import secrets
import string
from datetime import datetime, timezone

import bcrypt

ACCESS_CODE_ALPHABET = string.ascii_uppercase + string.digits
_IPV4_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode()[:72], hashed.encode())


def generate_session_token() -> str:
    """Cryptographically secure opaque bearer token for admin/event sessions."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """SHA-256 hex digest so raw session tokens are never stored in DB."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_event_access_code(length: int = 10) -> str:
    """Generate a 10-character uppercase alphanumeric event code."""
    return "".join(secrets.choice(ACCESS_CODE_ALPHABET) for _ in range(length))


def generate_event_uid() -> str:
    """Generate a unique human-readable event identifier (e.g. EVT-20261111-A1B2C3)."""
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    rand_part = secrets.token_hex(3).upper()
    return f"EVT-{date_part}-{rand_part}"


def sanitize_bucket_name(event_name: str, suffix: str | None = None) -> str:
    """Convert arbitrary event name into a valid Cloudflare R2 bucket name (3-63 chars, [a-z0-9-])."""
    slug = re.sub(r"[^a-z0-9]+", "-", event_name.lower()).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    if not slug:
        slug = "photography"
    if not slug.startswith("event-"):
        slug = f"event-{slug}"

    suffix_clean = ""
    if suffix:
        suffix_clean = "-" + re.sub(r"[^a-z0-9]+", "", suffix.lower())

    max_base_len = 63 - len(suffix_clean)
    base = slug[:max_base_len].rstrip("-")
    if not base:
        base = "event"
    candidate = f"{base}{suffix_clean}".strip("-")
    if len(candidate) < 3:
        candidate = f"event-{candidate or 'box'}"
    if _IPV4_RE.match(candidate):
        candidate = f"event-{candidate.replace('.', '-')}"
    return candidate[:63].rstrip("-")


def sign_media_params(photo_code: str, exp: int, secret_key: str) -> str:
    """Create short-lived HMAC signature for authenticated admin media URLs."""
    payload = f"{photo_code}:{exp}".encode("utf-8")
    return hmac.new(secret_key.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def verify_media_signature(photo_code: str, exp: int, sig: str, secret_key: str) -> bool:
    if exp < int(datetime.now(timezone.utc).timestamp()):
        return False
    expected = sign_media_params(photo_code, exp, secret_key)
    return hmac.compare_digest(expected, sig)
