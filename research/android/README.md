# Wild Rift Android research

Research-only pipeline for inspecting the publicly distributed Wild Rift Android package. Nothing here writes to Postgres or `apps/scraper`.

The goal is to learn whether detailed gameplay data (ability numbers, items, runes, stats) lives in the packaged APKs, is referenced via a public Riot CDN/manifest, or is delivered only after install.

## Constraints

- Inspect archive contents, readable strings, manifests, and public URLs only.
- Do not bypass Cloudflare, captchas, DRM, TLS, auth, or anti-tamper.
- Do not reverse-engineer `libil2cpp.so` or decrypt assets.
- Do not commit APKs, APKMs, or APKMirror download keys.

If APKMirror blocks the fetcher, use `--from-file` with a locally downloaded bundle.

## Acquire the bundle, not a thin APK

Wild Rift ships as an Android App Bundle. The APKMirror **bundle** (`.apkm`) is a ZIP of splits. We need:

| File | Why |
| --- | --- |
| `base.apk` | Manifest, config, URLs, resource-loader hints |
| `split_pad1.apk` | Play Asset Delivery pack — most likely assets / baked data |

ABI/language splits are left in the APKM.

## Commands

From the repo root:

```bash
# Cron-safe: listing HTML only. Prints latest APKMirror version vs last acquisition.
npx tsx research/android/scripts/acquire.ts --check

# Download the bundle for a store version (large; local only).
npx tsx research/android/scripts/acquire.ts --version 7.2.0.2460

# Use a file you already downloaded when APKMirror blocks the fetcher.
npx tsx research/android/scripts/acquire.ts --from-file path/to/wildrift.apkm --version 7.2.0.2460

# Or point at an already-unpacked APKM directory (links base.apk + split_pad1.apk).
npx tsx research/android/scripts/acquire.ts --from-dir path/to/unpacked-apkm --version 7.2.0.2460

# Extract info.json, base.apk, and split_pad1.apk from the APKM.
npx tsx research/android/scripts/unpack-apkm.ts --version 7.2.0.2460

# Full first-pass investigation (inventory, manifest, strings, probes).
npx tsx research/android/scripts/inspect.ts --version 7.2.0.2460
```

Individual steps:

```bash
npx tsx research/android/scripts/inventory-apk.ts --version 7.2.0.2460 --target base
npx tsx research/android/scripts/inventory-apk.ts --version 7.2.0.2460 --target pad1
npx tsx research/android/scripts/parse-manifest.ts --version 7.2.0.2460
npx tsx research/android/scripts/scan-strings.ts --version 7.2.0.2460 --target base
npx tsx research/android/scripts/scan-strings.ts --version 7.2.0.2460 --target pad1
npx tsx research/android/scripts/scan-probes.ts --version 7.2.0.2460 --target pad1
```

`--apk <path>` can replace `--version` on the inspect scripts.

## Layout

```text
research/android/
  scripts/     committed CLIs
  reports/     committed inventories and FINDINGS.md
  input/       gitignored APKs / APKMs
  extracted/   gitignored full unpack (unused by the first pass)
```

First-pass scans read ZIP entries in place. They do not extract `split_pad1.apk`.

## Reports

After a successful inspect:

```text
reports/acquisition.json
reports/apkm-info.json
reports/base-file-list.txt
reports/base-file-list.json
reports/pad1-file-list.txt
reports/pad1-file-list.json
reports/android-manifest.md
reports/string-hits.json
reports/urls.json
reports/champion-hits.json
reports/indexes/
reports/FINDINGS.md              # curated conclusions
reports/FINDINGS.generated.md    # machine draft from the latest inspect
```
