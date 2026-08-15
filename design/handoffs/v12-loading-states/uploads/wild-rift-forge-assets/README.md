# Wild Rift Forge — asset bundle + gatherer

This package is set up around the exact filenames requested by Wild Rift Forge.

## Already included in `uploads/`

- All 3 requested rune files
- All 10 requested item files
- All 5 Garen ability files
- All 5 Darius ability files
- `splash-garen.jpg`
- `splash-darius.jpg`

That is **25 ready-to-drop files**.

Icon assets are exported as **256×256 PNG**. The two included splash files are exported as **1600×900 JPG**.

## Finish the remaining champion art automatically

The included `gather-wild-rift-assets.mjs` fills the rest of the requested ability and splash filenames into the same `uploads/` directory. Existing files are skipped, so it will keep the 25 files above and only fetch what is missing.

```bash
npm i --no-save sharp
node gather-wild-rift-assets.mjs
```

To intentionally overwrite existing files:

```bash
node gather-wild-rift-assets.mjs --force
```

### What the script targets

Abilities (P/Q/W/E/R):

- Garen, Darius
- Sett, Volibear, Renekton, Ashe
- Ahri, Yasuo, Jinx, Camille, Fiora, Malphite, Jax, Irelia, Caitlyn, Draven, Vayne, Nasus, Teemo, Leona, Braum, Rammus

Splash art:

- Garen, Darius, Ahri, Yasuo, Jinx, Camille, Fiora, Malphite, Jax, Irelia, Caitlyn, Draven, Vayne, Nasus, Teemo, Leona, Braum, Rammus

## Source strategy

1. **Champion abilities and base splash:** first tries Riot's public Wild Rift champion pages and parses their public `__NEXT_DATA__` payload.
2. **Fallback for champion art:** RiftGG's Wild Rift asset mirror.
3. **Current item/rune icons:** RiftGG's Wild Rift asset mirror.
4. **Legacy assets:** WildRiftGuides mirror, only where the requested asset no longer exists in the current game.

## Two legacy filenames in the request

- `rune-hunter-titan.png`: Hunter - Titan is a historical Wild Rift rune. Riot replaced it with Perseverance in patch 4.2 (2023). The included file deliberately preserves the old Wild Rift icon rather than substituting a current rune.
- `item-spirit-visage.png`: Spirit Visage was removed from Wild Rift in patch 7.0 (2026). The included file deliberately preserves its Wild Rift icon so the existing UI slot still has the requested art.

## Notes

- The script writes exactly the filenames expected by the app.
- Icons are normalized to 256×256 PNG.
- Splash images are normalized to 1600×900 JPG using a centered cover crop.
- Riot game artwork remains Riot Games intellectual property; keep the project aligned with Riot's applicable fan-content / third-party developer policies and attribution requirements.
