# Manual champion overrides

Drop one JSON file per champion here. Overrides are never written into `data/raw/` or generated snapshots in place.

```json
{
  "champion": "swain",
  "patch": "7.2c",
  "changes": {
    "e.returnDamage": {
      "value": [35, 85, 135, 185],
      "source": "manual_ingame",
      "verified": true
    }
  }
}
```

Priority when building a snapshot:

1. Riot official patch deltas
2. Manual verified overrides in this folder
3. WildRiftFire baseline
