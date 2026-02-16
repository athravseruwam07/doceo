from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.models.session import get_session
from app.schemas.exam_cram import ExamCramResponse, ExamCramTextRequest
from app.services.exam_cram_service import build_exam_cram_plan

router = APIRouter()


_MAX_UPLOAD_BYTES = 2 * 1024 * 1024


def _looks_like_text(raw: bytes) -> bool:
    if not raw:
        return False
    sample = raw[:4096]
    if b"\x00" in sample:
        return False
    printable = sum(1 for b in sample if 9 <= b <= 13 or 32 <= b <= 126)
    ratio = printable / max(1, len(sample))
    return ratio >= 0.7


def _decode_upload_bytes(raw: bytes) -> str:
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return raw.decode(encoding)
        except Exception:
            continue
    return raw.decode("utf-8", errors="ignore")


@router.post("/{session_id}/exam-cram", response_model=ExamCramResponse)
async def create_exam_cram_plan_json(session_id: str, body: ExamCramTextRequest):
    """Generate a predictive exam-cram plan from text materials."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    materials = [
        {"name": f"Material {idx + 1}", "source_type": "text", "content": text}
        for idx, text in enumerate(body.materials or [])
        if isinstance(text, str) and text.strip()
    ]

    if not materials:
        raise HTTPException(status_code=400, detail="No materials provided")

    result = await build_exam_cram_plan(
        session_id=session_id,
        materials=materials,
        subject_hint=body.subject_hint,
        exam_name=body.exam_name,
    )
    if result is None:
        raise HTTPException(
            status_code=400,
            detail="Failed to build exam cram plan. Try shorter text inputs or fewer files.",
        )

    return ExamCramResponse(**result)


@router.post("/{session_id}/exam-cram/upload", response_model=ExamCramResponse)
async def create_exam_cram_plan_upload(
    session_id: str,
    files: list[UploadFile] = File(default=[]),
    notes: str = Form(default=""),
    subject_hint: str | None = Form(default=None),
    exam_name: str | None = Form(default=None),
):
    """Generate exam-cram plan from uploaded files and optional notes."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    materials: list[dict[str, str]] = []

    if notes.strip():
        materials.append(
            {
                "name": "Instructor Notes",
                "source_type": "text",
                "content": notes,
            }
        )

    skipped_files: list[str] = []
    for upload in files:
        raw = await upload.read()
        if not raw:
            continue
        if len(raw) > _MAX_UPLOAD_BYTES:
            skipped_files.append(upload.filename or "Unnamed file")
            continue
        if not _looks_like_text(raw):
            skipped_files.append(upload.filename or "Unnamed file")
            continue
        decoded = _decode_upload_bytes(raw)
        materials.append(
            {
                "name": upload.filename or "Uploaded Material",
                "source_type": "upload",
                "content": decoded,
            }
        )

    if not materials:
        detail = "No readable text materials provided. Paste notes or upload .txt/.md files."
        if skipped_files:
            detail += f" Skipped files: {', '.join(skipped_files[:5])}."
        raise HTTPException(status_code=400, detail=detail)

    result = await build_exam_cram_plan(
        session_id=session_id,
        materials=materials,
        subject_hint=subject_hint,
        exam_name=exam_name,
    )
    if result is None:
        raise HTTPException(
            status_code=400,
            detail="Failed to build exam cram plan. Paste text notes or upload readable text files.",
        )

    return ExamCramResponse(**result)


@router.get("/{session_id}/exam-cram", response_model=ExamCramResponse)
async def get_exam_cram_plan(session_id: str):
    """Get the latest generated exam-cram plan for a session."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    payload = session.get("exam_cram")
    if not payload:
        raise HTTPException(status_code=404, detail="Exam cram plan not found")

    return ExamCramResponse(**payload)
