"""Domain exceptions.

These are translated into HTTP responses by the error_handler
middleware in `adapters/inbound/middleware`. The domain layer never
raises HTTP exceptions directly.
"""


class DomainError(Exception):
    """Base exception for all domain-level errors."""


class UnauthorizedError(DomainError):
    """Raised when an operation is attempted without proper authorization."""


class DuplicateEmailError(DomainError):
    """Raised when trying to register a user with an already-used email."""


class InvalidCredentialsError(DomainError):
    """Raised when login credentials (email/password) do not match."""


class ForbiddenError(DomainError):
    """Raised when an authenticated user is not allowed to perform an operation.

    Examples: a user without the required role attempting a restricted
    action, or a user trying to act on a resource owned by someone else.
    Translated to HTTP 403 by the error_handler middleware.
    """


class ItemNotFoundError(DomainError):
    """Raised when the requested catalogue item does not exist.

    Translated to HTTP 404 by the error_handler middleware.
    """


class DuplicateSlugError(DomainError):
    """Raised when trying to save an item whose slug is already taken.

    Translated to HTTP 409 by the error_handler middleware.
    """
