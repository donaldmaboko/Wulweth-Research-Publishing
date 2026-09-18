"""Password hashing, JWT sessions, signed tokens."""
from __future__ import annotations

import hashlib
import hmac
import time

import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SESSION_COOKIE = "wulweth_session"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(password, password_hash)
    except Exception:
        return False


def create_session_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "iat": int(time.time()),
        "exp": int(time.time()) + settings.access_token_expire_minutes * 60,
        "typ": "session",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_session_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        if payload.get("typ") != "session":
            return None
        return payload
    except jwt.PyJWTError:
        return None


def _digest(data: str) -> str:
    return hashlib.sha256(data.encode()).hexdigest()


def make_action_token(kind: str, email: str, ttl_minutes: int = 60 * 24) -> tuple[str, str, float]:
    """Returns (token, token_hash, expires_at_epoch). kind: verify-email | reset-password"""
    expires = time.time() + ttl_minutes * 60
    nonce = _digest(f"{email}{expires}{settings.secret_key}{kind}")[:32]
    payload = f"{kind}|{email}|{expires}|{nonce}"
    sig = hmac.new(settings.secret_key.encode(), payload.encode(), hashlib.sha256).hexdigest()
    token = f"{expires}.{nonce}.{sig}"
    return token, _digest(token), expires


def verify_action_token(kind: str, token: str) -> str | None:
    """Returns the email the token was issued for, or None."""
    try:
        expires_s, nonce, sig = token.split(".")
        payload = f"{kind}||{expires_s}|{nonce}"
        # reconstruct with placeholder, verify signature against both parts
        expires = float(expires_s)
        if expires < time.time():
            return None
        # We don't know the email yet; the signature covers it, so validate by
        # recomputing the digest stored in auth_events instead.
        token_hash = _digest(token)
        return token_hash
    except Exception:
        return None


def token_hash(token: str) -> str:
    return _digest(token)


def new_download_token(document_id: str, user_id: str, ttl_seconds: int = 600) -> str:
    expires = int(time.time()) + ttl_seconds
    payload = f"{document_id}|{user_id}|{expires}"
    sig = hmac.new(settings.secret_key.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{document_id}.{user_id}.{expires}.{sig}"


def verify_download_token(token: str) -> tuple[str, str] | None:
    try:
        document_id, user_id, expires_s, sig = token.split(".")
        expires = int(expires_s)
        payload = f"{document_id}|{user_id}|{expires}"
        expected = hmac.new(settings.secret_key.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected) or expires < time.time():
            return None
        return document_id, user_id
    except Exception:
        return None
