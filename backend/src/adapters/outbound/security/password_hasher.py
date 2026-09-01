"""Bcrypt-based implementation of the `PasswordHasher` port."""

from passlib.context import CryptContext

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class BcryptPasswordHasher:
    """Implements `PasswordHasher` (see `domain/ports/services.py`) with bcrypt."""

    def hash(self, plain_password: str) -> str:
        return _pwd_context.hash(plain_password)

    def verify(self, plain_password: str, hashed_password: str) -> bool:
        return bool(_pwd_context.verify(plain_password, hashed_password))
