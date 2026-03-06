from pydantic import BaseModel


class RewriteRequest(BaseModel):
    text: str


class RewriteResponse(BaseModel):
    original_text: str
    rewritten_text: str
    model: str