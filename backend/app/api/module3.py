from fastapi import APIRouter

router = APIRouter()

@router.get('/landmarks/{session_id}')
async def landmarks(session_id: str):
    return {"session_id": session_id, "frames": []}

@router.get('/pro/{player_id}')
async def pro(player_id: str):
    return {"player_id": player_id, "frames": []}
