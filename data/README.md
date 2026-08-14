# Gameplay data

JSON is the canonical intermediate format. Postgres import comes later.

```text
data/
  raw/champions/7.2c/champion-baseline.json   # immutable bootstrap
  normalized/champions/7.2c/*.json            # one file per champion
  patches/7.2c.json                           # official Riot deltas
  overrides/champions/                        # manual in-game corrections
  reports/                                    # validation + gap output
```

```bash
npx tsx scripts/data/import-baseline.ts --patch 7.2c
npx tsx scripts/data/validate-champion-data.ts --patch 7.2c
npx tsx scripts/data/generate-snapshot.ts --from 7.2c --apply 7.2d
```

Source priority: Riot patch notes → manual overrides → WildRiftFire baseline.
