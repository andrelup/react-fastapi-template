"""JWT implementation of the `TokenService` port, backed by python-jose."""

from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

from src.domain.exceptions import UnauthorizedError


class JwtTokenService:
    """Implements `TokenService` (see `domain/ports/services.py`) issuing HS256 JWTs."""

    def __init__(self, secret_key: str, algorithm: str, expires_minutes: int) -> None:
        self._secret_key = secret_key
        self._algorithm = algorithm
        self._expires_minutes = expires_minutes

    def create_access_token(self, subject: str) -> str:
        expires_at = datetime.now(UTC) + timedelta(minutes=self._expires_minutes)
        payload = {"sub": subject, "exp": expires_at}
        return jwt.encode(payload, self._secret_key, algorithm=self._algorithm)

    def decode_token(self, token: str) -> str:
        try:
            payload = jwt.decode(token, self._secret_key, algorithms=[self._algorithm])
        except JWTError as exc:
            raise UnauthorizedError("Invalid or expired token") from exc

        subject = payload.get("sub")
        if not subject:
            raise UnauthorizedError("Token payload is missing its subject")
        return str(subject)
