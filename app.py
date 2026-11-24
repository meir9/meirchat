import os
import sys
import types
import uvicorn
from fastapi.responses import FileResponse, Response

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.environ["MEIRCHAT_CLOUD"] = "1"
os.environ.setdefault("MEIRCHAT_DATA_DIR", "/tmp/meirchat_data")

_pkg = types.ModuleType("app")
_pkg.__path__ = [os.path.join(BASE_DIR, "app")]
sys.modules["app"] = _pkg

from app.main import app as fastapi_app
from app.paths import STATIC_DIR
from app.auth import SESSION_COOKIE_NAME, is_auth_enabled, verify_session_token


@fastapi_app.middleware("http")
async def _hf_root_health_middleware(request, call_next):
    if request.url.path == "/" and request.method in ("GET", "HEAD"):
        if is_auth_enabled() and not verify_session_token(request.cookies.get(SESSION_COOKIE_NAME)):
            if request.method == "HEAD":
                return Response(status_code=200)
            return FileResponse(os.path.join(STATIC_DIR, "login.html"), status_code=200)
    return await call_next(request)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", os.environ.get("GRADIO_SERVER_PORT", "7860")))
    uvicorn.run(fastapi_app, host="0.0.0.0", port=port)