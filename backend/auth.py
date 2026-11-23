
import os
import sqlite3
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash

DB = os.getenv("VISION_DB", "vision_events.db")
JWT_SECRET = os.getenv("VISION_JWT_SECRET", "")
JWT_ALGORITHM = "HS256"

password_hash = PasswordHash.recommended()
bearer = HTTPBearer(auto_error=False)


def connect():
    db = sqlite3.connect(DB, timeout=10)
    db.row_factory = sqlite3.Row
    return db


def init_auth_db():
    with connect() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'admin',
                active INTEGER NOT NULL DEFAULT 1
            )
        """)
        db.commit()


def create_admin(username: str, password: str):
    if not username.strip() or len(password) < 12:
        raise ValueError(
            "Usuario obligatorio y contraseña de mínimo 12 caracteres."
        )

    init_auth_db()

    with connect() as db:
        db.execute(
            """
            INSERT INTO users (username, password_hash, role)
            VALUES (?, ?, 'admin')
            """,
            (
                username.strip(),
                password_hash.hash(password),
            ),
        )
        db.commit()


def authenticate(username: str, password: str):
    with connect() as db:
        user = db.execute(
            "SELECT * FROM users WHERE username = ?",
            (username,),
        ).fetchone()

    if not user or not user["active"]:
        return None

    if not password_hash.verify(
        password, user["password_hash"]
    ):
        return None

    return dict(user)


def create_token(user: dict):
    if not JWT_SECRET or len(JWT_SECRET) < 32:
        raise RuntimeError(
            "VISION_JWT_SECRET debe tener al menos 32 caracteres."
        )

    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user["id"]),
        "iat": now,
        "exp": now + timedelta(hours=2),
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def current_user(
    credentials: HTTPAuthorizationCredentials | None =
        Depends(bearer),
):
    error = HTTPException(
        status_code=401,
        detail="Sesión inválida o expirada",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        raise error

    if credentials.scheme.lower() != "bearer":
        raise error

    if not JWT_SECRET or len(JWT_SECRET) < 32:
        raise HTTPException(
            status_code=503,
            detail="Autenticación no configurada",
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp"]},
        )
        user_id = int(payload["sub"])
    except (InvalidTokenError, ValueError, KeyError, TypeError):
        raise error

    with connect() as db:
        user = db.execute(
            """
            SELECT id, username, role, active
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()

    if not user or not user["active"]:
        raise error

    return dict(user)
