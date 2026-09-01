"""Ports for external services consumed by the domain (Protocol interfaces).

Concrete implementations (bcrypt, JWT, embeddings, LLMs, ...) live in
`adapters/outbound`. The domain only ever depends on these contracts.
"""

from typing import Protocol


class PasswordHasher(Protocol):
    """Contract for one-way password hashing and verification."""

    def hash(self, plain_password: str) -> str:
        """Return a salted hash of `plain_password`."""
        ...

    def verify(self, plain_password: str, hashed_password: str) -> bool:
        """Return True if `plain_password` matches `hashed_password`."""
        ...


class TokenService(Protocol):
    """Contract for issuing and verifying access tokens."""

    def create_access_token(self, subject: str) -> str:
        """Issue a signed access token identifying `subject` (e.g. a user email)."""
        ...

    def decode_token(self, token: str) -> str:
        """Return the subject encoded in `token`.

        Raises:
            UnauthorizedError: if the token is missing, malformed, expired or
                has an invalid signature.
        """
        ...
