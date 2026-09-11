# Backend Logging

How logging is wired in this codebase, and the rules a new log line must follow. Read this before
adding any logging call, and before touching the middleware or the logging configuration.

The operator-facing side of the same subject — where the log file physically lives, what survives a
crash, rotation and restart policy — is documented for humans in `infra/README.md`, section
**«Logs y reinicio»**. This document is about the code.

---

## 1. The two pieces

| File | Responsibility |
|---|---|
| `backend/src/config/logging.py` | `configure_logging()` — builds the structlog pipeline and bridges stdlib `logging` |
| `backend/src/adapters/inbound/middleware/logging.py` | `RequestLoggingMiddleware` — one `http_request` event per request, and the `request_id` binding |

`configure_logging()` is called from two places: `src/main.py`, before the `FastAPI` app is built,
and `seed.py`, before its first logger call. It is idempotent — a module-level guard makes repeated
calls a no-op — so importing either entry point twice does not stack processors or handlers.

It is a direct call, **not** a `lifespan` hook. It only mutates in-process logging state (no socket,
file or database access), so it does not violate the "no side effects at import time" rule in
`main.py`'s docstring, and calling it eagerly means the very first line logged in the process
already goes through the configured pipeline.

---

## 2. Output format

The final renderer is chosen from `settings.environment`:

- A development alias — `development`, `dev` or `local`, compared case-insensitively and stripped —
  selects `ConsoleRenderer(colors=True)`.
- **Anything else** selects `JSONRenderer()`.

The alias set exists because the repo spells the same idea three ways: the versioned `.env.example`
says `development`, a developer's own untracked `.env` commonly says `dev`, and
`infra/docker-compose.yml` defaults `ENVIRONMENT` to `production`. An unrecognised value falls back
to JSON on purpose — a typo must never accidentally enable console rendering outside development.

`LOG_LEVEL` (default `INFO`) sets the level for both structlog and the stdlib loggers.

Neither variable needs adding: both already exist in `settings.py` and in the root `.env.example`.

---

## 3. The stdlib bridge

`configure_logging()` also runs `logging.config.dictConfig`, routing the root logger plus `uvicorn`,
`uvicorn.error`, `uvicorn.access` and `sqlalchemy` through the same `ProcessorFormatter`. The
practical consequence: **every line in the process has the same shape**, whether the application
emitted it or a library did. Do not add a second handler or a second formatter anywhere; anything
that logs through stdlib `logging` is already covered.

Output goes to `sys.stdout` and nowhere else. There is no `FileHandler`, and adding one would be a
mistake — see `infra/README.md`.

---

## 4. `request_id` and how correlation works

`RequestLoggingMiddleware` binds a per-request `request_id` into structlog's **contextvars** on
entry, and clears them in a `finally`. Because `merge_contextvars` is the first processor in the
chain, every log line emitted anywhere during that request — router, domain service, repository,
exception handler — carries the id automatically.

That is the mechanism to rely on. **Never thread a `request_id` argument through function
signatures** to get correlation; it is already there.

The middleware also:

- Reuses an inbound `X-Request-ID` header **only when it matches `[A-Za-z0-9_-]{1,64}`**, otherwise
  mints a fresh `uuid4().hex`. The header is caller-controlled and ends up both in the logs and in a
  response header, so an unvalidated value would let a caller forge log entries. Do not relax this.
- Sets `request.state.request_id`, for anything that needs it inside the request.
- Returns the id in the `X-Request-ID` response header.
- Emits exactly one `http_request` event per request with `method`, `path`, `status_code` and
  `duration_ms` (measured with `time.perf_counter()`), at `info`, or at `error` with `exc_info` when
  the request raised.

### Registration order

The middleware is registered in `main.py` **after** the `CORSMiddleware` block. Starlette applies
`add_middleware` in reverse registration order, so registering last puts it outermost, where it sees
the real response status code including CORS preflight responses. Keep that order if you add more
middleware.

### `user_id` is deliberately absent

`backend/CLAUDE.md` used to promise an automatic `user_id` field. It is not there, and that is a
decision: the user is resolved by the `get_current_user` dependency, which an outer middleware
cannot see without duplicating the JWT logic. If a use case ever needs it, bind it into contextvars
from the dependency — never by re-parsing the token in the middleware.

---

## 5. Rules for writing a log line

- **Never use `print()`.** Get a logger with `structlog.get_logger(__name__)` at module level.
- **The event name is a short, stable, snake_case string** — `http_request`, `domain_error`. Put the
  variable parts in keyword fields, not in the message. `logger.info("item_created", item_id=id)`,
  never `logger.info(f"Created item {id}")`. String interpolation destroys the reason JSON output
  exists.
- **Levels:** `info` for the normal path; `warning` for expected failures the client caused (the 4xx
  domain errors); `error` with `exc_info=True` for anything unexpected (5xx). The exception handlers
  in `error_handler.py` already follow this — match it.
- **Never log a secret**: no passwords, no tokens, no full `Authorization` headers, no hashed
  passwords. A log line is written to disk and shipped to a third party.
- **The domain layer stays clean.** Logging belongs in adapters — routers, middleware, repositories.
  A domain service that logs is a domain service coupled to an outbound concern; raise a typed
  exception and let the adapter log it.

---

## 6. Testing logging

Use `structlog.testing.capture_logs` to assert on events. One gotcha worth knowing: **`capture_logs`
disables the configured processors for its duration**, so contextvar-bound fields such as
`request_id` disappear unless you re-add the processor explicitly:

```python
structlog.testing.capture_logs(processors=(structlog.contextvars.merge_contextvars,))
```

Existing examples to copy:

- `backend/tests/unit/test_logging_middleware.py` — builds a throwaway `FastAPI()` app, asserts the
  event fields, the `X-Request-ID` header, header reuse, the malformed-header rejection and the
  error path.
- `backend/tests/unit/test_logging_config.py` — renderer selection per environment alias.
- `backend/tests/api/test_logging.py` — end-to-end correlation: the id in the log matches the id in
  the response header, across both a success and a mapped domain error.

---

## 7. Verify

```bash
# No stray prints
grep -rn "print(" backend/src/

# The suite, including the logging tests
cd backend && python -m pytest tests/unit/test_logging_middleware.py \
    tests/unit/test_logging_config.py tests/api/test_logging.py -v

# Live: the id in the log must match the response header, and a 401 must
# produce both a domain_error line and an http_request line sharing it
curl -i http://localhost:8000/health
curl -i http://localhost:8000/auth/me
```

## Checklist for a change that touches logging

- [ ] No `print()` anywhere in `backend/src/`
- [ ] Event names are stable identifiers; variable data lives in keyword fields
- [ ] No secret, token or credential appears in any field
- [ ] No `request_id` threaded through a function signature
- [ ] The domain layer still does not log
- [ ] `configure_logging()` is still idempotent and still called before the app is built
- [ ] The middleware is still registered after `CORSMiddleware`
- [ ] New behaviour has a test, and coverage stays above the 80 % gate
