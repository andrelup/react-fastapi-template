"""Domain exceptions.

These are translated into HTTP responses by the error_handler
middleware in `adapters/inbound/middleware`. The domain layer never
raises HTTP exceptions directly.
"""


class DomainError(Exception):
    """Base exception for all domain-level errors."""


class BookNotFoundError(DomainError):
    """Raised when a requested book does not exist."""


class UnauthorizedError(DomainError):
    """Raised when an operation is attempted without proper authorization."""


class DuplicateEmailError(DomainError):
    """Raised when trying to register a user with an already-used email."""


class InvalidCredentialsError(DomainError):
    """Raised when login credentials (email/password) do not match."""


class ForbiddenError(DomainError):
    """Raised when an authenticated user is not allowed to perform an operation.

    Examples: a customer trying to create/delete a book, or a seller trying
    to edit or delete another seller's book. Translated to HTTP 403 by the
    error_handler middleware.
    """


class BookValidationError(DomainError):
    """Raised when book data violates a domain business rule."""


class FavouriteListNotFoundError(DomainError):
    """Raised when a requested favourite list does not exist."""


class DuplicateFavouriteListNameError(DomainError):
    """Raised when a customer already owns a favourite list with the same name."""


class FavouriteListValidationError(DomainError):
    """Raised when favourite list data violates a domain business rule."""


class DuplicateFavouriteBookError(DomainError):
    """Raised when adding a book already present in the favourite list."""
