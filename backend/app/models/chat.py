from datetime import datetime
from typing import Optional, Literal
from pydantic import Field
from app.models.common import MongoBaseModel, PyObjectId

class ChatMessage(MongoBaseModel):
    role: Literal['user', 'assistant', 'system', 'summary']
    content: str
    createdat: datetime = Field(default_factory=datetime.utcnow)

class ChatContextLink(MongoBaseModel):
    sessionid: PyObjectId
    linktype: Literal['current', 'compare', 'reference']

class ChatSessionDocument(MongoBaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias='_id')
    userid: PyObjectId
    currentsessionid: Optional[PyObjectId] = None
    sessionsummary: Optional[str] = None
    summaryupdatedat: Optional[datetime] = None
    messages: list[ChatMessage] = Field(default_factory=list)
    contextlinks: list[ChatContextLink] = Field(default_factory=list)
    createdat: datetime = Field(default_factory=datetime.utcnow)
