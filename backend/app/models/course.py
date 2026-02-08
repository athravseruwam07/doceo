import io
import json
import re
import uuid
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

MAX_MATERIAL_SIZE_BYTES = 120 * 1024 * 1024  # 120 MB per upload
MAX_CHUNKS_PER_MATERIAL = 4000

_courses: dict[str, dict[str, Any]] = {}
_backend_root = Path(__file__).resolve().parents[2]
_data_dir = _backend_root / "data"
_courses_file = _data_dir / "courses.json"


def _utc_now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def _ensure_storage() -> None:
    _data_dir.mkdir(parents=True, exist_ok=True)
    if not _courses_file.exists():
        _courses_file.write_text("{}", encoding="utf-8")


def _load_courses() -> None:
    global _courses
    _ensure_storage()
    try:
        payload = json.loads(_courses_file.read_text(encoding="utf-8"))
    except Exception:
        payload = {}

    if isinstance(payload, dict):
        _courses = payload
    else:
        _courses = {}


def _save_courses() -> None:
    _ensure_storage()
    _courses_file.write_text(
        json.dumps(_courses, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def _normalize_whitespace(text: str) -> str:
    lines = [line.strip() for line in text.replace("\r\n", "\n").split("\n")]
    cleaned = "\n".join(lines)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _decode_text_bytes(contents: bytes) -> str:
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return contents.decode(encoding)
        except Exception:
            continue
    return contents.decode("utf-8", errors="ignore")


def _extract_pdf_text(contents: bytes) -> str:
    try:
        from pypdf import PdfReader
    except Exception as exc:
        raise ValueError(
            "PDF uploads require the pypdf dependency on the backend."
        ) from exc

    reader = PdfReader(io.BytesIO(contents))
    pages: list[str] = []
    for page in reader.pages:
        extracted = page.extract_text() or ""
        if extracted.strip():
            pages.append(extracted.strip())
    return "\n\n".join(pages)


def _extract_docx_text(contents: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(contents)) as archive:
            document_xml = archive.read("word/document.xml")
    except Exception as exc:
        raise ValueError("Could not parse DOCX file.") from exc

    try:
        root = ElementTree.fromstring(document_xml)
    except Exception as exc:
        raise ValueError("DOCX XML structure is invalid.") from exc

    text_parts: list[str] = []
    for node in root.iter():
        if node.tag.endswith("}t") and node.text:
            text_parts.append(node.text)
    return "\n".join(text_parts)


def _extract_text(filename: str, contents: bytes) -> str:
    suffix = Path(filename).suffix.lower()

    if suffix in {".txt", ".md", ".markdown", ".csv", ".json"}:
        return _decode_text_bytes(contents)
    if suffix == ".pdf":
        return _extract_pdf_text(contents)
    if suffix == ".docx":
        return _extract_docx_text(contents)

    # Fallback: attempt plain-text decode for unknown extensions.
    return _decode_text_bytes(contents)


def _chunk_text(text: str, chunk_size: int = 950, overlap: int = 140) -> list[str]:
    if not text:
        return []

    normalized = _normalize_whitespace(text)
    if not normalized:
        return []

    chunks: list[str] = []
    index = 0
    total_len = len(normalized)

    while index < total_len:
        end = min(total_len, index + chunk_size)
        # Prefer sentence boundary when possible.
        if end < total_len:
            boundary = normalized.rfind(". ", index, end)
            if boundary > index + chunk_size // 2:
                end = boundary + 1

        chunk = normalized[index:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= total_len:
            break
        index = max(end - overlap, index + 1)

    return chunks


def _downsample_chunks(chunks: list[str], max_chunks: int) -> list[str]:
    """Keep a spread of chunks across the full document when it is very large."""
    if len(chunks) <= max_chunks:
        return chunks

    step = len(chunks) / max_chunks
    sampled: list[str] = []
    index = 0.0
    for _ in range(max_chunks):
        sampled.append(chunks[int(index)])
        index += step
    return sampled


def _serialize_course(course: dict[str, Any]) -> dict[str, Any]:
    return {
        "course_id": course.get("course_id"),
        "label": course.get("label"),
        "created_at": course.get("created_at"),
        "material_count": len(course.get("materials", [])),
    }


def _serialize_material(material: dict[str, Any]) -> dict[str, Any]:
    return {
        "material_id": material.get("material_id"),
        "filename": material.get("filename"),
        "content_type": material.get("content_type"),
        "uploaded_at": material.get("uploaded_at"),
        "char_count": material.get("char_count", 0),
        "chunk_count": material.get("chunk_count", 0),
        "preview": material.get("preview", ""),
    }


def create_course(label: str) -> dict[str, Any]:
    cleaned = re.sub(r"\s+", " ", label).strip()
    if not cleaned:
        raise ValueError("Course label is required.")

    # Reuse existing course when labels match exactly (case-insensitive).
    for existing in _courses.values():
        if cleaned.lower() == str(existing.get("label", "")).strip().lower():
            return _serialize_course(existing)

    course_id = str(uuid.uuid4())[:8]
    course = {
        "course_id": course_id,
        "label": cleaned,
        "created_at": _utc_now_iso(),
        "materials": [],
        "chunks": [],
    }
    _courses[course_id] = course
    _save_courses()
    return _serialize_course(course)


def list_courses() -> list[dict[str, Any]]:
    serialized = [_serialize_course(course) for course in _courses.values()]
    return sorted(serialized, key=lambda item: item["created_at"], reverse=True)


def get_course(course_id: str) -> dict[str, Any] | None:
    return _courses.get(course_id)


def delete_course(course_id: str) -> dict[str, Any] | None:
    course = _courses.pop(course_id, None)
    if course is None:
        return None
    _save_courses()
    return _serialize_course(course)


def list_materials(course_id: str) -> list[dict[str, Any]] | None:
    course = get_course(course_id)
    if course is None:
        return None
    return [_serialize_material(material) for material in course.get("materials", [])]


def add_material(
    course_id: str, filename: str, content_type: str | None, contents: bytes
) -> dict[str, Any] | None:
    course = get_course(course_id)
    if course is None:
        return None

    if len(contents) > MAX_MATERIAL_SIZE_BYTES:
        max_mb = MAX_MATERIAL_SIZE_BYTES // (1024 * 1024)
        raise ValueError(f"File is too large. Maximum supported size is {max_mb} MB.")

    extracted = _extract_text(filename, contents)
    normalized = _normalize_whitespace(extracted)
    if len(normalized) < 40:
        if Path(filename).suffix.lower() == ".pdf":
            raise ValueError(
                "Could not extract text from this PDF. If it is scanned/image-based, "
                "run OCR on the PDF and upload again."
            )
        raise ValueError("Could not extract enough text from this file.")

    chunks = _chunk_text(normalized)
    if not chunks:
        raise ValueError("Could not split this document into searchable chunks.")
    chunks = _downsample_chunks(chunks, MAX_CHUNKS_PER_MATERIAL)

    material_id = str(uuid.uuid4())[:10]
    material = {
        "material_id": material_id,
        "filename": filename,
        "content_type": content_type or "application/octet-stream",
        "uploaded_at": _utc_now_iso(),
        "char_count": len(normalized),
        "chunk_count": len(chunks),
        "preview": normalized[:260],
    }

    chunk_rows = []
    for index, chunk in enumerate(chunks):
        chunk_rows.append(
            {
                "chunk_id": f"{material_id}-{index + 1}",
                "material_id": material_id,
                "filename": filename,
                "text": chunk,
            }
        )

    course.setdefault("materials", []).append(material)
    course.setdefault("chunks", []).extend(chunk_rows)
    _save_courses()
    return _serialize_material(material)


def _tokenize_query(query: str) -> list[str]:
    return [token for token in re.findall(r"[a-zA-Z0-9_]+", query.lower()) if len(token) > 2]


def _score_chunk(text: str, tokens: list[str], query: str) -> int:
    lowered = text.lower()
    score = 0
    for token in tokens:
        occurrences = lowered.count(token)
        if occurrences:
            score += min(occurrences, 4) * 2

    if query.strip() and query.lower().strip() in lowered:
        score += 8

    return score


def search_course_snippets(
    course_id: str, query: str, top_k: int = 5
) -> list[dict[str, Any]]:
    course = get_course(course_id)
    if course is None:
        return []

    chunks = course.get("chunks", [])
    if not chunks:
        return []

    tokens = _tokenize_query(query)
    scored: list[tuple[int, dict[str, Any]]] = []
    for chunk in chunks:
        text = str(chunk.get("text", "")).strip()
        if not text:
            continue
        score = _score_chunk(text, tokens, query)
        if tokens and score <= 0:
            continue
        scored.append((score if score > 0 else 1, chunk))

    if not scored:
        scored = [(1, chunk) for chunk in chunks[:top_k]]

    scored.sort(key=lambda item: item[0], reverse=True)

    snippets: list[dict[str, Any]] = []
    for score, chunk in scored[:top_k]:
        snippets.append(
            {
                "material_id": chunk.get("material_id"),
                "filename": chunk.get("filename"),
                "text": str(chunk.get("text", ""))[:700],
                "score": score,
            }
        )
    return snippets


_load_courses()
