# Android investigation findings

Research pass on Wild Rift store build **7.2.0.2460** (versionCode `7246064`), acquired from a local APKMirror bundle. Scripts and inventories live under `research/android/`. Nothing here is wired into `apps/scraper` or Postgres.

## Package

| | |
| --- | --- |
| Package | `com.riotgames.league.wildrift` |
| Store version | `7.2.0.2460` |
| Resource `VerInfo` | `7.2.0.0` (not `7.2c`) |
| Main activity | `com.tencent.lolm.lgame` |
| Engine | Unity IL2CPP (`assets/bin/Data/Managed/Metadata/global-metadata.dat`) |
| base.apk | 1535 files, 97.8 MB uncompressed |
| split_pad1.apk | 1110 files, 518.2 MB uncompressed |

`pad1` is a Play Asset Delivery pack. Almost all of it is hashed blobs under `assets/assetpack/Res/*.bytes`. Named indexes:

- `assets/assetpack/PADSet.json` — two groups. Group `1` is 1104 packaged files; group `2` is audio (`Audio/Audio.bytes`, `Init.bnk`) **not** in this pack.
- `assets/assetpack/Res/LCData.bytes` — catalog of **1207** `.vfs` names. Only **one** VFS file is in the APK (`Res/LData/4069fcb0….vfs`).
- `assets/assetpack/Res/VerInfo.bytes` — resource version `7.2.0.0` plus three hashes.
- `assets/assetpack/filelist.json.png` — JSON with placeholder `http://defulturl`.
- `assets/assetpack/tcf` — `ASTC` (texture format).

Copies of the small indexes are in [`indexes/`](indexes/).

## 1. Does base.apk contain champion data?

No structured champion kit or stats. base.apk is the Unity bootstrap plus Tencent/Riot account, geo, and cloud stubs.

Interesting named files exist but are **not** plaintext gameplay JSON:

- `assets/CloudConfig/default_cloud.json` — ciphertext / obfuscated blob
- `assets/Region/RegionManifest.json` — same
- `assets/RiotGeoConfig/*.json` — same
- `assets/bin/Data/Managed/Metadata/global-metadata.dat` — IL2CPP metadata (type names, not ability numbers)

Champion-like strings in base are mostly false positives (`Garena` partner auth, password-dictionary JS).

## 2. Does split_pad1.apk contain champion data?

**Names and localization, not numbers.** Readable ASCII in hashed `.bytes` files includes:

- Asset IDs such as `_Garen`, `SGaren`
- Ability titles such as `Decisive Strike`, `Demacian Justice`, `` `Vorpal" ``

These look like a localization / presentation table inside opaque resource blobs (notably `Res/ee647999….bytes` and `Res/eca47929….bytes`). There is no `champions/garen.json` or similar.

`LCData` says most game VFS packs are **not** in this APK and must be fetched after install.

## 3. Are detailed ability numbers present?

**Outcome C.** Neither Vorpal Spikes sequence (`15/35/55/75` nor `20/45/70/95`) appears as readable text in base or pad1.

Interpretation: current balance numbers are not sitting in the Play Store package as plaintext. They are likely in downloaded VFS/IFS packs, binary tables, or server-controlled config. That matches store version `7.2.0.2460` staying put while `7.2a/b/c` shipped.

## 4. Where are champion icons stored?

Not as named PNGs. Icons are almost certainly inside the hashed `assets/assetpack/Res/*.bytes` set (ASTC textures / Unity assets) or in the missing VFS packs. No exporter was written.

Largest pad1 tree: `assets/assetpack/Res` (1075 files, ~516 MB).

## 5. Where are ability icons stored?

Same hashed Res blobs. Ability **names** appear in localization-like `.bytes`; icon pixels are not separately listed.

## 6. Are Riot CDN endpoints exposed?

No `riotcdn` host. Public Wild Rift / GCloud hostnames that **are** in the package:

| Host | Where |
| --- | --- |
| `https://msdk.wr.pvp.net` | `assets/MSDKConfig.ini` |
| `https://gcloudctrl.wr.pvp.net` | AndroidManifest meta-data `GCloud.GCloudCore.RemoteConfigUrl` |
| `https://tdm.wr.pvp.net:8013/tdm/v1/route` | Manifest `GCloud.TDM.TGEMIT_ROUTER_ADDRESS_FORMAL` |
| `udp://na.gvoice.cros.wr.pvp.net:8700` | GVoice |
| `https://cloudctrl.gcloud.qq.com` | GCloud telemetry |
| `https://wildrift.go.link/…` | Adjust / friend-finder deep links |

Tencent COS URLs for a **CN user-return / new-champion marketing** patch also appear (not gameplay data):

- `https://tc-cn-pub-1258390525.file.myqcloud.com/CN/Default/ShareReturn/Patch/…`

`filelist.json.png` only has the placeholder `http://defulturl` — the real IFS base URL is filled in at runtime (likely from GCloud remote config).

## 7. Are resource manifests exposed?

Yes, **in-package indexes**, not a public Riot RMAN/WAD pipeline:

- `PADSet.json` — PAD file list
- `filelist.bytes` / `filelist.json.png` — IFS file list
- `LCData.bytes` — VFS catalog (1207 entries, 1 shipped)
- `VerInfo.bytes` — resource version `7.2.0.0`

This is a Tencent GCloud / IFS / VFS system, not League PC `lol.dyn.riotcdn.net` manifests.

## 8. Does the client reference downloadable resource packages?

Yes, several layers:

1. Play Asset Delivery — `AssetPackExtractionService`, `com.android.vending.splits`, `split_pad1.apk`
2. OBB downloader — `obbDownloaderService`, `com.tencent.lolm.ObbReciever`
3. Tencent download service — `TMAssistantDownloadService`
4. IFS/VFS — `first_source.ifs.res.png`, `LCData` listing 1206 VFS files that are **not** in the APK
5. PADSet group `2` audio files not packaged in pad1

## 9. Is there evidence gameplay balance data is delivered separately?

**Yes.** Combined evidence:

- Store APK stayed at `7.2.0.2460` through `7.2a/b/c`
- Packaged resource version is `7.2.0.0`, not a balance-letter build
- Cho'Gath number test is Outcome C
- 1207 VFS names vs 1 VFS file on disk
- Encrypted `default_cloud.json` / `RegionManifest.json` (runtime config, not readable here)

## 10. Can this data realistically be acquired automatically?

| Path | Verdict |
| --- | --- |
| APKMirror `--check` | Yes. Small HTML, cron-safe. Latest listing currently matches `7.2.0.2460`. |
| APKMirror full bundle download | Fragile (Cloudflare). `--from-file` / `--from-dir` is the reliable path. Too large for GitHub Actions. |
| Parse hashed `.bytes` / VFS for numbers | Not yet. Would need a format parser; do not decrypt or bypass protection. |
| Public `*.wr.pvp.net` config | **Next cheapest probe.** Manifest already publishes `gcloudctrl.wr.pvp.net`. Fetch only unauthenticated, small JSON if the host serves it. |
| Production Forge ingest from APK | **No.** Names exist; coefficients do not, in readable form. |

## 11. What should we investigate next?

Follow the **resource-infrastructure** branch (not an APK number parser, not an emulator collector yet):

1. Document and, if public, fetch `https://gcloudctrl.wr.pvp.net` and related `*.wr.pvp.net` config endpoints. Record host, path, and whether a versioned file list is returned. Do not authenticate or bypass anything.
2. Treat `LCData` + `PADSet.json` + `VerInfo` as the in-client catalog. Diff them when a new store APK appears.
3. Keep Riot patch notes as the source for numeric deltas (`15/35/55/75` → `20/45/70/95`).
4. Only later: identify whether localization `.bytes` that contain `Decisive Strike` are a documented container we can parse without reversing IL2CPP.

## Classification

| Category | This pass |
| --- | --- |
| A Static assets | Hashed `Res/*.bytes` (ASTC / Unity). No named icon tree. |
| B Static metadata | Ability/champion **names** in localization blobs; store + resource versions. |
| C Gameplay data | **Not present** as readable text (Outcome C). |
| D Resource infrastructure | **Highest value.** GCloud `wr.pvp.net`, PAD/IFS/VFS catalogs, Play Asset Delivery, OBB. |

## Decision

Do **not** build a production APK scraper. The packaged client is a loader plus a partial asset pack. The preferred next source is whatever public GCloud/IFS manifest `gcloudctrl.wr.pvp.net` (or a successor URL in the next APK) exposes. Until that is readable, Forge should keep using Riot website kits + patch-note deltas.

## Reports

- `acquisition.json`, `apkm-info.json`
- `base-file-list.txt` / `.json`, `pad1-file-list.txt` / `.json`
- `android-manifest.md` / `.json`
- `string-hits.json`, `urls.json`, `champion-hits.json`
- `indexes/PADSet.json`, `VerInfo.txt`, `LCData.txt`, `filelist.txt`, `filelist.json`
