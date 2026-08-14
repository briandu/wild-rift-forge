# Android investigation findings

Generated from `research/android/reports/`. Research only — not a production data source.

## Package

- Store version: `7.2.0.2460`
- Acquisition: `local-file`
- Source URL: `C:\Users\brian\Downloads\com.riotgames.league.wildrift_7.2.0.2460-7246064_2arch_1feat_57b78854fb62cb6c97039f57d48e03e6_apkmirror.com`
- Package: `com.riotgames.league.wildrift`
- base.apk files: 1535 (102565551 bytes uncompressed)
- split_pad1.apk files: 1110 (543332570 bytes uncompressed)
- Keyword hits: 2253
- Unique URLs: 400

## 1. Does base.apk contain champion data?

- `AndroidManifest.xml` (49836 bytes)
- `DebugProbesKt.bin` (1738 bytes)
- `androidsupportmultidexversion.txt` (53 bytes)
- `assets/Audio/Audio.bytes` (63 bytes)
- `assets/CloudConfig/default_cloud.json` (3756 bytes)
- `assets/LZW/down_lzwdict_7_0_0.bin` (30712 bytes)
- `assets/MSDKBuglyConfig.json` (692 bytes)
- `assets/MSDKConfig.ini` (3825 bytes)
- `assets/MSDKRetMsg.json` (1596 bytes)
- `assets/Region/RegionManifest.json` (8428 bytes)
- `assets/RiotGeoConfig/Config.json` (876 bytes)
- `assets/RiotGeoConfig/LocalNA.json` (2156 bytes)
- `assets/RiotGeoConfig/LocalRoW.json` (2008 bytes)
- `assets/RiotGeoConfig/TextSet.json` (15980 bytes)
- `assets/api_key.txt` (1358 bytes)

Name probes are reported in section 2 / `champion-hits.json`. Text-like champion files in base would show up under interesting extensions above.

## 2. Does split_pad1.apk contain champion data?

- `garen`: 60 hit(s)
- `darius`: 60 hit(s)
- `ahri`: 60 hit(s)
- `cho'gath`: 23 hit(s)
- `chogath`: 5 hit(s)
- `cho gath`: 0 hit(s)
- `vorpal spikes`: 0 hit(s)
- `vorpal`: 3 hit(s)
- `feast`: 9 hit(s)
- `decisive strike`: 1 hit(s)
- `courage`: 60 hit(s)
- `judgment`: 7 hit(s)
- `judgement`: 6 hit(s)
- `demacian justice`: 1 hit(s)

Number-test outcome **C**: Neither Vorpal Spikes number sequence was found as readable text. Numbers may be binary, server-controlled, or not in this package.

Interesting pad1 files:

- `AndroidManifest.xml` (1616 bytes)
- `assets/assetpack/PADSet.json` (50399 bytes)
- `assets/assetpack/Res/00ecdd2dcf4cb64c3d5af1f7bbe092a2.bytes` (61117 bytes)
- `assets/assetpack/Res/015e6beaa5e3e6c26dc4ab526cf9f4d7.bytes` (6172639 bytes)
- `assets/assetpack/Res/019623b1efa2c8220bb5367610169b66.bytes` (577092 bytes)
- `assets/assetpack/Res/01cf44ef8b748aee810cab7624040944.bytes` (178874 bytes)
- `assets/assetpack/Res/0242c5a46d4e90517e15e250daa2f422.bytes` (85206 bytes)
- `assets/assetpack/Res/024c072898a78094e47ae6d5e6527eee.bytes` (2277790 bytes)
- `assets/assetpack/Res/02592d917eafc28b6bcf5c354300d15c.bytes` (34994 bytes)
- `assets/assetpack/Res/027fe27f38c4eddaca0aef55b608a0ab.bytes` (738272 bytes)
- `assets/assetpack/Res/02b98ebfd0c55744025b9dfc0e34a505.bytes` (6670 bytes)
- `assets/assetpack/Res/02de540a75e7d2b466fcd8b96a05c056.bytes` (780525 bytes)
- `assets/assetpack/Res/02eaf2d026bcfc6611d8818073814c28.bytes` (190849 bytes)
- `assets/assetpack/Res/02edb80f7ab02ce8d48ca66d63cab30f.bytes` (104931 bytes)
- `assets/assetpack/Res/03b592cd91dc798ba25dcd954cb5d611.bytes` (183715 bytes)

## 3. Are detailed ability numbers present?

Cho'Gath Vorpal Spikes test outcome **C**. Neither Vorpal Spikes number sequence was found as readable text. Numbers may be binary, server-controlled, or not in this package.

## 4. Where are champion icons stored?

From inventories, look for png / webp / ktx / Unity / AssetBundle paths. Largest pad1 directories:

- `assets/assetpack/Res` (1075 files, 540993301 bytes)
- `assets/assetpack/Res/LData` (1 files, 987564 bytes)
- `assets/assetpack` (6 files, 696535 bytes)
- `assets/assetpack/Video/Compliance` (1 files, 307554 bytes)
- `META-INF` (3 files, 248406 bytes)
- `assets/assetpack/Res/FETest/LuaGen` (2 files, 54179 bytes)
- `assets/assetpack/Res/FETest/FrameWork` (13 files, 27869 bytes)
- `assets/assetpack/Res/FETest/common` (4 files, 12999 bytes)
- `(root)` (2 files, 1648 bytes)
- `assets/assetpack/Res/FETest/Logic` (1 files, 1480 bytes)

## 5. Where are ability icons stored?

Same as section 4 until a named ability icon path appears in `string-hits.json` or `champion-hits.json`. No exporter was written in this pass.

## 6. Are Riot CDN endpoints exposed?

- `https://wildrift.go.link8https://wildrift-twm.go.link8https://wildrift-vng.go.link`
- `https://wildrift.go.link/?type=FriendFinder&params={0}&adj_t=1ryt5dms`
- `https://wildrift-twm.go.link/?type=FriendFinder&params={0}&adj_t=1rjxmnmw`
- `https://wildrift-vng.go.link/?type=FriendFinder&params={0}&adj_t=1ry7rz0n`
- `https://wildrift.go.link/?type=GuildApply&params={0}&adj_t=1r3qyydo`
- `https://wildrift-twm.go.link/?type=GuildApply&params={0}&adj_t=1r56w6e7`
- `https://wildrift-vng.go.link/?type=GuildApply&params={0}&adj_t=1rulw1v2`
- `https://gh.riotgames.com/pages/player-accounts/accounts-react-components/?path=/story/views-sign-in--terms-of-service`

## 7. Are resource manifests exposed?

- `http://ns.adobe.com/xap/1.0/sType/ResourceEvent#`
- `http://ns.adobe.com/xap/1.0/sType/ResourceRef#`
- `https://tc-cn-dev-1258390525.cos.ap-nanjing.myqcloud.com/CN/Default/ShareReturn/Patch/Adaptation/PatchContent/UserReturnVersionConfig.json`
- `https://tc-cn-pub-1258390525.file.myqcloud.com//CN/Default/ShareReturn/Patch/Adaptation/PatchContent/UserReturnVersionConfig.json`
- `https://tc-cn-dev-1258390525.cos.ap-nanjing.myqcloud.com/^https://tc-cn-pub-1258390525.file.myqcloud.com/zCN/Default/ShareReturn/Patch/Adaptation/NewChampiones/{0}.jpg`
- `https://www.googleadservices.com/pagead/conversion/app/deeplink?id_type=adid&sdk_version=%s&rdid=%s&bundleid=%s&retry=%s`

Keyword buckets `manifest`, `patch`, `resource`, and `cdn` are in `string-hits.json`.

## 8. Does the client reference downloadable resource packages?

See `android-manifest.md` (asset-pack / download / update services) and string hits for `pad1`, `download`, `update`, and `asset`.

## 9. Is there evidence gameplay balance data is delivered separately?

The Play Store build stayed at `7.2.0.2460` while balance patches `7.2a/b/c` shipped. Combined with the Cho'Gath number test:

- Outcome C: Neither Vorpal Spikes number sequence was found as readable text. Numbers may be binary, server-controlled, or not in this package.

## 10. Can this data realistically be acquired automatically?

- APKMirror listing check (`--check`) is small and cron-safe.
- Full bundle download is hundreds of megabytes and may be blocked by Cloudflare. `--from-file` remains the reliable path.
- Automatic ingest into Forge is **not** justified until a stable public manifest/CDN or a clearly parsed in-package format exists.

## 11. What should we investigate next?

No (or incomplete) in-package numbers, but CDN/manifest/patch URLs are exposed. Next: document those endpoints and fetch only small public manifests — preferred long-term source.

## Classification

| Category | Evidence in this pass |
| --- | --- |
| A Static assets | Inventory directories and image/bundle extensions |
| B Static metadata | Manifest package/version; any champion name hits |
| C Gameplay data | Cho'Gath number-test outcome |
| D Resource infrastructure | URLs and manifest/CDN/patch string hits |

## Reports

- `acquisition.json`
- `apkm-info.json`
- `base-file-list.txt` / `base-file-list.json`
- `pad1-file-list.txt` / `pad1-file-list.json`
- `android-manifest.md`
- `string-hits.json`
- `urls.json`
- `champion-hits.json`
