# WildRiftFire champion data

WildRiftFire is the **only** source for champion gameplay numbers and ability text in Forge.

Do not mix Riot patch-note values, League PC data, or other community sites into this dataset. If WildRiftFire omits a field, store `null` and record a gap. If the parser cannot understand a field, flag it — do not guess.

The older mixed file `data/raw/champions/7.2c/champion-baseline.json` is a migration reference only.

## Refresh

```text
npm run wrf:scrape                 # discover /guide pages, refetch missing champs
npm run wrf:scrape -- --force      # refetch every guide
npm run wrf:scrape -- --reprocess  # re-normalize from stored text (no HTTP)
npm run wrf:scrape-one -- --id garen
npm run wrf:validate
npm run wrf:diff -- --from <prev-dir> --to data/normalized/champions
npm run wrf:import                 # write cooldown / cost / numeric text onto champion_abilities
```

Requests use the existing 1.5s politeness gap. A full roster is a few minutes.

If more than 20% of champions show major ability-path diffs, `wrf:diff` sets `requireReview` — treat that as a parser/HTML break until reviewed.

## Layout

```text
data/raw/wildriftfire/champion-index.json
data/raw/wildriftfire/YYYY-MM-DD/{id}.json     extracted debug snapshot (not full HTML)
data/normalized/champions/{id}.json            one champion
data/normalized/champions.json                 collection
data/reports/wildriftfire-champion-gaps.json
data/reports/wildriftfire-manual-review.json
data/reports/wildriftfire-diff.json
```

`data/normalized/champions/7.2c/` is the previous mixed-source snapshot. Leave it alone.

## Source metadata

Every champion record has:

```json
{
  "source": {
    "provider": "WildRiftFire",
    "sourceType": "champion_guide",
    "url": "https://www.wildriftfire.com/guide/garen",
    "observedPatch": "7.2c",
    "scrapedAt": "2026-08-14T..."
  }
}
```

`observedPatch` is whatever that guide page displays. Do not infer a global patch. If the page has no patch, it is `null`.
