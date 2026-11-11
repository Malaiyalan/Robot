from dataclasses import dataclass
from io import BytesIO

from PIL import Image, UnidentifiedImageError

from app.core.config import settings

ALLOWED_FORMATS: dict[str, tuple[str, str]] = {
    "JPEG": ("image/jpeg", "jpg"),
    "PNG": ("image/png", "png"),
    "WEBP": ("image/webp", "webp"),
}


class ImageValidationError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class ValidatedImage:
    data: bytes
    mime_type: str
    extension: str
    file_size: int
    width: int
    height: int


def _matches_magic_bytes(data: bytes) -> str | None:
    if len(data) < 12:
        return None
    if data[:3] == b"\xff\xd8\xff":
        return "JPEG"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "PNG"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "WEBP"
    return None


def validate_uploaded_image(data: bytes) -> ValidatedImage:
    """Validate byte size, magic header, and real image integrity for JPEG, PNG, or WebP."""
    if not data:
        raise ImageValidationError("Uploaded file is empty.")

    if len(data) > settings.max_upload_bytes:
        raise ImageValidationError(
            f"Image exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB} MB.",
            status_code=413,
        )

    detected_magic = _matches_magic_bytes(data)
    if not detected_magic:
        raise ImageValidationError(
            "Unsupported image format. Only valid JPEG, PNG, and WebP photographs are allowed.",
            status_code=415,
        )

    try:
        with Image.open(BytesIO(data)) as img:
            img_format = (img.format or "").upper()
            width, height = img.size
            img.verify()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ImageValidationError("Uploaded file is corrupted or not a valid image.", status_code=400) from exc

    if img_format != detected_magic or img_format not in ALLOWED_FORMATS:
        raise ImageValidationError(
            "Image content does not match supported JPEG, PNG, or WebP formats.",
            status_code=415,
        )

    if width <= 0 or height <= 0:
        raise ImageValidationError("Image dimensions are invalid.", status_code=400)

    mime_type, ext = ALLOWED_FORMATS[img_format]
    return ValidatedImage(
        data=data,
        mime_type=mime_type,
        extension=ext,
        file_size=len(data),
        width=width,
        height=height,
    )

