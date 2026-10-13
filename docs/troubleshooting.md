# Troubleshooting and errors

## Python common errors

| Error or code | Likely cause | Resolution |
|---|---|---|
| `GYM_NOT_FOUND` | Gym name not found in `list_gyms()` | Print the gym list and use the exact gym name |
| `INVALID_CREDENTIALS` | Login rejected | Check account, gym, credentials |
| `SESSION_REQUIRED` | Authenticated method called before login | Call `await api.login(...)` first |
| `SESSION_EXPIRED` | Backend session invalidated | Close and sign in again; don't retry writes automatically |
| `CONNECTION_FAILED` | Network, TLS, private API unavailable | Check connectivity and service status; private endpoint may have changed |
| `REMOTE_TIMEOUT` | No response from hub within timeout | Increase timeout or retry **read-only** requests cautiously |
| `BROWSER_DISABLED` | `browser_enabled=False` | Recreate client with `browser_enabled=True` |
| `BROWSER_MISSING` | Playwright not installed | Install `iclub_api[browser]` and Chromium |
| `BOOKING_EVENT_NOT_FOUND` | Event not uniquely in requested calendar window | Pass the correct `start`/`end` and event ID |
| `BOOKING_EVENT_AMBIGUOUS` | More than one matching visible UI event | Verify manually; SDK intentionally does not guess |
| `TOPUP_UNAVAILABLE` | Account disallows credit top-up | Consult your gym; cannot force-enable it |

Python exposes `IClubError.code` and `IClubError.retryable`.

## Node.js common errors

`IClubError` is exported and has `code`, `retryable`, and `status` properties. The underlying source also uses several `NFITNESS_*` and `ICLUB_*` code prefixes; treat these as internal and subject to change. Generic JavaScript `Error`s are also possible for argument validation or dependencies.

## `ModuleNotFoundError: iclub_api`

Confirm you installed the **new** package and are running the same Python interpreter:

```bash
python -m pip show iclub_api
python -c 'import iclub_api; print(iclub_api.__version__)'
```

The distribution name is `iclub_api`; PyPI normalizes this to `iclub-api`, but the import stays `iclub_api`.

## `ERR_MODULE_NOT_FOUND` or `ERR_REQUIRE_ESM`

Install `iclub-api` in the Node project directory. Use `import` and run with Node.js 20+ (`.mjs` or package `"type": "module"`). This library does not ship a CommonJS entry point.

## Playwright browser not found

Run:

```bash
python -m playwright install chromium
# OR
npx playwright install chromium
```

In containers, additional Linux system dependencies may be required; refer to Playwright's platform documentation.

## QR selector failure / changed iClub website

Run with `headless=False` in Python to inspect the actual page. Check that gym selection and language are correct. Selectors are private implementation details and may require updating. Don't bypass security challenges or automate actions without the account owner's consent.

## Payments and booking

If the SDK reports an action submitted with `confirmed: false`, check your account in the official iClub interface. Don't call the mutation repeatedly to try to obtain a confirmation.

## Test locally

```bash
cd python && python -m pip install -e '.[test]' && python -m pytest -q
cd ../nodejs && npm install && npm run check
```

These are unit/smoke tests and do not use real gym accounts.
