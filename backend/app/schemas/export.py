from pydantic import BaseModel


class ExportResponse(BaseModel):
    session_id: str
    title: str
    subject: str
    steps: list
    chat_log: list
    exam_materials: list = []
    exam_cram: dict | None = None
