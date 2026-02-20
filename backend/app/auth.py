"""JWT validation dependency for FastAPI.

Extracts and validates the NextAuth JWT from the Authorization header or
the session cookie, then returns the authenticated user_id.
"""

import logging

from fastapi import HTTPException, Request, WebSocket
from jose import JWTError, jwt

from app.config import settings

logger = logging.getLogger(__name__)

_ALGORITHM = "HS256"


def _get_token_from_auth_header(auth_header: str | None) -> str | None:
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header[7:]
    return None


def _decode_user_id(token: str) -> str:
    """Decode HS256 auth token and return the NextAuth user id (`sub`)."""

    secret = settings.nextauth_secret
    if not secret:
        logger.error("NEXTAUTH_SECRET is not configured on the backend")
        raise HTTPException(status_code=500, detail="Auth configuration error")

    try:
        payload = jwt.decode(token, secret, algorithms=[_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def _get_token_from_cookies(cookies: dict[str, str]) -> str | None:
    token = cookies.get("next-auth.session-token")
    if token:
        return token
    return cookies.get("__Secure-next-auth.session-token")


def get_current_user_id(request: Request) -> str:
    """FastAPI dependency that extracts user_id from bearer token or cookies."""
    token = _get_token_from_auth_header(request.headers.get("authorization"))
    if not token:
        token = _get_token_from_cookies(request.cookies)

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return _decode_user_id(token)


def get_current_user_id_from_websocket(websocket: WebSocket) -> str:
    """Authenticate websocket clients via bearer token or session cookie."""
    token = _get_token_from_auth_header(websocket.headers.get("authorization"))
    if not token:
        token = _get_token_from_cookies(websocket.cookies)

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return _decode_user_id(token)
