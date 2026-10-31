import os
from rest_framework.exceptions import ValidationError

DISALLOWED_FILE_EXTENSIONS = {
    ".exe",
    ".bat",
    ".cmd",
    ".sh",
    ".py",
    ".js",
    ".vbs",
    ".ps1",
    ".dll",
    ".msi",
    ".com",
    ".scr",
    ".php",
    ".phtml",
    ".cgi",
    ".pl",
    ".jar",
    ".apk",
    ".bin",
}

DEFAULT_MAX_UPLOAD_SIZE = 25 * 1024 * 1024  # 25 MB


def validate_file_upload(
    file_obj,
    max_size_bytes: int = DEFAULT_MAX_UPLOAD_SIZE,
    allowed_extensions: set | None = None,
    disallowed_extensions: set | None = None,
):
    """
    Validates uploaded file against path traversal, disallowed executable extensions,
    optional extension whitelist, and maximum size limits.
    
    Returns (safe_filename, extension, file_size).
    Raises rest_framework.exceptions.ValidationError on failure.
    """
    if not file_obj:
        raise ValidationError({"file": "هیچ فایلی برای بارگذاری ارسال نشده است."})

    original_name = getattr(file_obj, "name", "uploaded_file")
    safe_filename = os.path.basename(original_name)
    ext = os.path.splitext(safe_filename)[1].lower()

    effective_disallowed = (
        DISALLOWED_FILE_EXTENSIONS
        if disallowed_extensions is None
        else disallowed_extensions
    )

    if ext in effective_disallowed:
        raise ValidationError(
            {"file": f"بارگذاری فایل با پسوند امنیتی {ext} مجاز نمی‌باشد."}
        )

    if allowed_extensions is not None and ext not in allowed_extensions:
        allowed_str = ", ".join(sorted(allowed_extensions))
        raise ValidationError(
            {"file": f"پسوند فایل ({ext}) نامعتبر است. پسوندهای مجاز: {allowed_str}"}
        )

    file_size = getattr(file_obj, "size", 0)
    if file_size > max_size_bytes:
        max_mb = max_size_bytes // (1024 * 1024)
        raise ValidationError(
            {"file": f"حجم فایل ({file_size / (1024*1024):.1f} مگابایت) بیشتر از سقف مجاز ({max_mb} مگابایت) است."}
        )

    return safe_filename, ext, file_size
