# Art needed — Wild Rift Forge

Every slot below already renders a hatched monogram placeholder, so the app is
complete without the art. Dropping a file in is a one-line change.

Specs unless noted: **square PNG, transparent background, 256×256** (128 minimum).
Name files exactly as listed and put them in `uploads/`.

---

## 1. Runes — 3 files (smallest job, finishes the matchup rail)

| Name | Filename |
| --- | --- |
| Conqueror | `rune-conqueror.png` |
| Bone Plating | `rune-bone-plating.png` |
| Hunter–Titan | `rune-hunter-titan.png` |

## 2. Items — 10 files (matchup rail + profile Builds tab)

| Name | Filename |
| --- | --- |
| Trinity Force | `item-trinity-force.png` |
| Plated Steelcaps | `item-plated-steelcaps.png` |
| Sterak's Gage | `item-steraks-gage.png` |
| Death's Dance | `item-deaths-dance.png` |
| Black Cleaver | `item-black-cleaver.png` |
| Mercury's Treads | `item-mercurys-treads.png` |
| Ionian Boots | `item-ionian-boots.png` |
| Spirit Visage | `item-spirit-visage.png` |
| Randuin's Omen | `item-randuins-omen.png` |
| Force of Nature | `item-force-of-nature.png` |

## 3. Champion abilities — 5 files each (P, Q, W, E, R)

Gwen is done. In priority order:

1. **Garen** and **Darius** — the Garen vs Darius matchup page is the flagship
   screen and shows ability icons in four places.
2. **Sett, Volibear, Renekton, Ashe** — used across counters, patch notes and
   the profile strip; they already have splash art.
3. Everyone else: Ahri, Yasuo, Jinx, Camille, Fiora, Malphite, Jax, Irelia,
   Caitlyn, Draven, Vayne, Nasus, Teemo, Leona, Braum, Rammus.

Filenames: `garen-passive.png`, `garen-q.png`, `garen-w.png`, `garen-e.png`,
`garen-r.png` — matching the existing `gwen-*.avif` pattern.

## 4. Champion splash art — 18 missing (landscape, 1600×900 or larger)

Have: Sett, Volibear, Gwen, Renekton, Ashe.

Need: Garen, Darius, Ahri, Yasuo, Jinx, Camille, Fiora, Malphite, Jax, Irelia,
Caitlyn, Draven, Vayne, Nasus, Teemo, Leona, Braum, Rammus.

Filenames: `splash-garen.jpg`, `splash-darius.jpg`, and so on. Champions without
splash currently fall back to an oversized initial on a gradient — that fallback
is deliberate and stays for anyone still missing.

Highest impact here: **Garen and Darius**, which would turn the matchup page's
placeholder halves into the real versus poster.

---

## Where each one lands

| Asset | Screens |
| --- | --- |
| Runes | Matchup rail (desktop + mobile) |
| Items | Matchup rail, profile Builds tab (core / boots / situational) |
| Abilities | Counters strip, profile strip, patch note lines, mobile champion screen |
| Splash | Matchup poster hero, counters hero, profile hero, roster tiles, tier list, draft slots |
