# Contributing and development

Contributions that improve documentation, type safety, test coverage and compatibility with legitimate authorized accounts are welcome. Do not submit scraped personal data, credentials or CAPTCHA/access-control bypasses.

## Repository layout

```text
iclub-api/
  python/           Python package, tests, and pyproject.toml
  nodejs/           ESM TypeScript package, tests, and package.json
  docs/             MkDocs-friendly Markdown documentation
  examples/         Minimal Python and Node.js examples
  .github/workflows/ Continuous integration and release workflows
  LICENSE           GNU GPL version 3 only
```

## Python development

```bash
python -m venv .venv
source .venv/bin/activate     # PowerShell: .venv\\Scripts\\Activate.ps1
python -m pip install -e './python[dev]'
cd python && python -m pytest -q
```

Python sources are in `python/src/iclub_api`. The async transport is in `transport.py`, the public facade in `client.py`, and optional browser integration in `browser.py`.

## Node development

```bash
cd nodejs
npm install
npm run check
npm pack --dry-run
```

Edit TypeScript sources in `nodejs/src`. Run the build to regenerate `dist/`; `dist/` is the runtime output published to npm. `npm install` is needed before compiling; npm network access is required when dependencies are missing.

## Docs site

```bash
python -m pip install -r docs/requirements.txt
mkdocs serve
mkdocs build --strict
```

To publish docs on GitHub Pages: `mkdocs gh-deploy` after configuring the repository settings, or use a suitable GitHub Actions workflow. Update links and changelog when releasing.

## Change process

1. Make focused changes in one or both language SDKs.
2. Add deterministic tests with mocked responses, especially for hub signatures and safety checks.
3. Preserve backward compatibility where practical. Document differences between languages.
4. Do not introduce live paid operations, repeated bookings, or implicit retries without explicit confirmation and tests.
5. Update `docs/api-reference.md`, README files and `docs/changelog.md`.
6. Submit changes under **GPL-3.0-only** and confirm you own rights to any newly added code.

## Versions

The two packages use the same version number but are separate registry projects. Use `python scripts/set_version.py X.Y.Z` to keep `python/pyproject.toml`, `nodejs/package.json` and the Python module version synchronized for joint releases. See [publishing](publishing.md).
