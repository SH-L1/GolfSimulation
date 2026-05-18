from pydantic import BaseModel

class LandmarkResponse(BaseModel):
    sessionid: str
