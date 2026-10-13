# Publish `iclub-api` on npm and `iclub_api` on PyPI

The SDK is already configured for both registries, but **you** must own an npm account and a PyPI account, accept their terms, and actually upload/publish. Editing metadata or building archives does not reserve a package name. Publishing cannot be performed without your approval and registry credentials.

## Names and public imports

| Registry | Registry project name | Install command | Import |
|---|---|---|---|
| npm | `iclub-api` | `npm install iclub-api` | `import { IClub } from 'iclub-api'` |
| PyPI | `iclub_api` | `pip install iclub_api` | `from iclub_api import IClub` |

**Important:** PyPI normalizes `_`, `-`, and `.` in project names to the same canonical key. **`iclub_api`, `iclub-api`, and `iclub.api` compete for the same PyPI name**. The Python import is independent and remains `iclub_api`. At documentation time the PyPI project page for `iclub-api` returned 404 (not proof it is reserved for you); npm package availability could not be reliably confirmed. Check availability immediately before first publish:

```bash
npm view iclub-api version
python -m pip index versions iclub_api
```

`npm view` can show a 404 for a nonexisting package; `pip index` similarly may show no matching distributions. Errors can also mean temporary network problems. If someone owns a name, you cannot publish to it without their permission. Pick a different name or use an npm scope such as `@your-user/iclub-api` (but this changes the published package name).

## 0. Pre-publication checklist

- Confirm you own rights to license all copied SDK code from ModernFITCLUB under **GPL-3.0-only**; third-party dependencies stay separately licensed.
- Check that `nodejs/package.json` and `python/pyproject.toml` use the intended name and matching version `0.1.0`.
- Set the real GitHub repository URL in package metadata if you want npm package-to-repository provenance. The provided release workflow fills it automatically from `GITHUB_REPOSITORY` at publish time.
- Do not publish source logs, account files, cookies, tokens, personal data, API secrets or browser profiles. Only `dist`, README and LICENSE go into the npm tarball.
- Run offline tests and **authorized live tests** before marketing support for QR, reservation or top-ups.
- Verify npm and PyPI names immediately before uploading.
- Set up **two-factor authentication** on both registry accounts.

## 1. Manual publish to npm

1. Register/sign into [npmjs.com](https://www.npmjs.com/signup) and configure 2FA.
2. Open a terminal in the extracted repository:

    ```bash
    cd nodejs
    npm install
    npm run check
    npm pack --dry-run
    npm login
    npm whoami
    npm publish --access public
    ```

3. Confirm the package on `https://www.npmjs.com/package/iclub-api` and test from a **different clean directory**:

    ```bash
    mkdir ../npm-consumer-test && cd ../npm-consumer-test
    npm init -y
    npm install iclub-api
    node --input-type=module -e "import {IClub} from 'iclub-api'; console.log(typeof IClub.listGyms)"
    ```

`npm publish` runs `prepack`, which compiles TypeScript into `dist/`; build dependencies must be installed first. npm requires 2FA or an appropriate approved publishing mechanism. For npm's current policies see [npm 2FA](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/).

**Caution:** npm versions are effectively immutable for a given package name + version. If you need to fix a release, bump the version (`0.1.1`) before publishing again.

## 2. Manual publish to PyPI

1. Create an account at [pypi.org/account/register/](https://pypi.org/account/register/) and configure 2FA.
2. Install build tooling in a temporary virtual environment:

    ```bash
    python -m venv .venv
    # Linux/macOS:
    source .venv/bin/activate
    # Windows PowerShell:
    # .venv\Scripts\Activate.ps1
    python -m pip install --upgrade build twine
    python -m build ./python --sdist --wheel --outdir ./dist
    python -m twine check ./dist/*
    ```

3. For the first publication, use PyPI's **Trusted Publishing** described below, or configure a restricted API token and upload:

    ```bash
    python -m twine upload dist/*
    ```

   If prompted, the username for token-based upload is `__token__`, and the password is your PyPI API token. Don't paste secrets into project code or GitHub.
4. Confirm on `https://pypi.org/project/iclub-api/` (canonicalized from `iclub_api`).
5. Test in a new environment:

    ```bash
    python -m venv .venv-check
    .venv-check/bin/python -m pip install iclub_api
    .venv-check/bin/python -c "from iclub_api import IClub; print(IClub.__name__)"
    ```

   On Windows use `.venv-check\Scripts\python` instead.

### Recommended: PyPI Trusted Publisher

You can register a *pending publisher* on PyPI even before the first release. Set:

- PyPI project name: **`iclub_api`** (canonical form `iclub-api`).
- Owner: your **real GitHub username/organization**.
- Repository: the **actual repository name**.
- Workflow filename: **`publish.yml`**.
- Environment: **`pypi`** (create this GitHub environment as well).

The provided release workflow (`.github/workflows/publish.yml`) uses `pypa/gh-action-pypi-publish@release/v1` with short-lived GitHub OIDC identity, so no stored long-lived PyPI token is required. See [PyPI's official Trusted Publisher guide](https://docs.pypi.org/trusted-publishers/using-a-publisher/).

## 3. GitHub automatic releases (recommended after the first publish)

This repository includes:

- `.github/workflows/ci.yml` — source builds, Python tests, Node tests on push/PR.
- `.github/workflows/publish.yml` — on **GitHub Release published**, builds and uploads Python distributions and publishes the npm package.

**Before triggering** a GitHub Release:

1. Push the full source repository to a public or private GitHub repo under your account.
2. Set up PyPI Trusted Publishing using the *exact* repo/workflow/environment names above.
3. Create the GitHub environment called `pypi` (optional reviewer protection recommended).
4. npm **first publish** can be manual via `npm publish --access public` as above; then in npm package settings configure a **Trusted Publisher** for GitHub Actions pointing to your actual repository and `publish.yml`. Configure permissions for **direct publishing** if using the included workflow, rather than stage-only. npm OIDC publishing requires npm CLI **11.5.1+** and Node **22.14+**; workflow uses Node 24 and updates npm.
5. Tag your release to match both package versions, e.g. `v0.1.0`, and publish a GitHub Release on that tag. The workflow validates version consistency.
6. Do not publish the same version twice; bump both manifests for the next release.

If you prefer npm stage + 2FA approval instead of direct trusted publishing, you must adapt the workflow's `npm publish` step to the staged publication flow.

More details: [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/), [PyPI Trusted Publishing](https://docs.pypi.org/trusted-publishers/).

## 4. Test without publishing

Build local artifacts:

```bash
python -m build ./python --sdist --wheel --outdir ./dist
cd nodejs && npm install && npm run build && npm pack
```

You can install a local Node tarball with `npm install ./path/to/iclub-api-0.1.0.tgz`; and a local wheel with `python -m pip install ./path/to/iclub_api-0.1.0-py3-none-any.whl` in a clean environment.

## 5. Update versions later

Run `python scripts/set_version.py 0.2.0` (or update **both** `nodejs/package.json:version` and `python/pyproject.toml:project.version`, plus `python/src/iclub_api/__init__.py`). Update `docs/changelog.md`. Rebuild/test, push and tag a new GitHub release `vX.Y.Z`. Follow semantic versioning: patch for fixes, minor for compatible additions, major for breaking changes (when API is stable). Private iClub endpoints can still change without notice.

## 6. License metadata verification

The npm manifest must contain `"license": "GPL-3.0-only"`. The Python `pyproject.toml` must contain `license = "GPL-3.0-only"` and `license-files = ["LICENSE"]`. Both archives include the actual GNU GPL 3.0 full-text license. The SPDX expression `GPL-3.0-only` means **version 3 only** (not automatically later versions).
