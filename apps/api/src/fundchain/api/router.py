from fastapi import APIRouter

from fundchain.api.routes import campaigns, health, users

router = APIRouter()
router.include_router(health.router)
router.include_router(campaigns.router)
router.include_router(users.router)
