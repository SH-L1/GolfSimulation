from fastapi import APIRouter

router = APIRouter()

@router.post('/login')
async def login():
    return {"message": "todo"}

@router.get('/me')
async def me():
    return {"message": "todo"}

@router.get('/verify')
async def verify():
    return {"valid": True}
