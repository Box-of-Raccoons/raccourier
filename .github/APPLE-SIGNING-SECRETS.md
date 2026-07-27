# Apple signing + notarization secrets (Box of Raccoons)

Shared convention so any Box of Raccoons project that ships a signed, notarized
macOS build reuses **one** set of GitHub Actions secrets instead of duplicating
them per repo. Set them once at the **organization** level; every repo's workflow
reads them through the identical `${{ secrets.NAME }}` reference, with no
per-repo copy and no workflow change.

Current consumers: **raccourier** (Electron, this repo) and
**claude-usage-watcher-mac** (Swift). Both reference the same five names below.

## The five secrets

| Secret name | What it is |
| --- | --- |
| `APPLE_CERT_P12_BASE64` | base64 of the Developer ID Application certificate, exported as `.p12` |
| `APPLE_CERT_PASSWORD` | the password protecting that `.p12` |
| `ASC_KEY_P8_BASE64` | base64 of the App Store Connect API key (`.p8`) used for notarization |
| `ASC_KEY_ID` | the API key's Key ID |
| `ASC_ISSUER_ID` | the API key's Issuer ID |

Identity in use: `Developer ID Application: Box of Raccoons LLC (X5B9LZJP7J)`.

## Plan caveat (important)

The `Box-of-Raccoons` org is on the **GitHub Free** plan. On Free, organization
secrets are readable by **public repositories only**. Private repos need GitHub
Team or Enterprise. Every project that signs a native app (raccourier,
claude-usage-watcher-mac) is public, so Free-tier org secrets cover the need at
no cost. If a **private** repo ever needs to sign, either upgrade the org to Team
(~$4/user/mo) or set the five as repo-level secrets on that one repo.

## Setting them (org admin, one time)

You need the original key material (the `.p12`, its password, the `.p8`, the key
ID, and the issuer ID). GitHub cannot read secret values back out, so copying
them from an existing repo is not possible; use the source files.

```bash
gh secret set APPLE_CERT_P12_BASE64 --org Box-of-Raccoons --visibility all --body "$(base64 < devid.p12)"
gh secret set APPLE_CERT_PASSWORD   --org Box-of-Raccoons --visibility all --body 'the-p12-password'
gh secret set ASC_KEY_P8_BASE64     --org Box-of-Raccoons --visibility all --body "$(base64 < AuthKey_XXXX.p8)"
gh secret set ASC_KEY_ID            --org Box-of-Raccoons --visibility all --body 'ABCD1234'
gh secret set ASC_ISSUER_ID         --org Box-of-Raccoons --visibility all --body '00000000-0000-0000-0000-000000000000'
```

`--visibility all` exposes them to every repo (private repos still cannot read
them on Free, they are simply skipped). For a tighter blast radius, use
`--visibility selected --repos raccourier,seniordev-app` to expose them only to
the repos that actually build native apps.

## How a consuming workflow uses them

electron-builder (raccourier) notarizes automatically when the App Store Connect
API-key env vars are present, and signs automatically when the Developer ID cert
is imported into the runner keychain. The mac job:

1. Imports the cert with `apple-actions/import-codesign-certs`
   (`p12-file-base64: ${{ secrets.APPLE_CERT_P12_BASE64 }}`,
   `p12-password: ${{ secrets.APPLE_CERT_PASSWORD }}`).
2. Writes the `.p8` from `ASC_KEY_P8_BASE64` and exports `APPLE_API_KEY` (path),
   `APPLE_API_KEY_ID` (`ASC_KEY_ID`), `APPLE_API_ISSUER` (`ASC_ISSUER_ID`).
3. Runs the build with `--publish never`. electron-builder signs + notarizes +
   staples the `.app`. Each credential step self-skips when its secret is absent,
   so a repo without the secrets still builds (unsigned, un-notarized).
4. Notarizes + staples the `.dmg` container separately (`xcrun notarytool submit
   --wait` then `xcrun stapler staple`), because electron-builder staples only the
   app, not the dmg. Without this the installed app is clean but the downloaded
   dmg is rejected by `spctl` and can prompt Gatekeeper on first open.
5. A separate `release` job (tag pushes only) publishes the stapled installers, so
   nothing un-stapled is uploaded mid-build.

See `.github/workflows/release.yml` in this repo for the concrete steps. A Swift
project (claude-usage-watcher-mac) consumes the same five secrets but signs and
notarizes with `codesign` + `xcrun notarytool` in `Scripts/sign-and-notarize.sh`
instead of electron-builder.

## Future: DRY the steps

With more than a couple of native-app projects, move the import-cert / write-p8 /
export-env steps into a composite action (for example a `Box-of-Raccoons/.github`
repo exposing `setup-apple-signing`) so each workflow shrinks to one `uses:`.
The secrets stay at the org level regardless; only the step boilerplate would
move. Not worth the machinery yet at two projects.
