# Assets

## Atlases (`assets/imageFiles.js` → `imageAtlases`)

Built with TexturePacker from `raw/<name>/` via `raw/<name>.tps`. Every colour variant is its
own frame (no runtime tint; the Canvas renderer can't tint).

| Key | Contents |
|---|---|
| `pixels` | 2×2 colour pixels (`white_pixel`, `red_pixel`, …): scale with `setScale(px / 2)` |
| `buttons` | UI: buttons, nine-slices, icons, node frames, more pixels |
| `player` | Tower, its glows/flash, cursor attack, weapons, resource drops, particles |
| `enemies` | Enemies, hit/death particles, warnings |
| `bosses` | Boss and miniboss parts |
| `attacks` | Attack animations (hit circles, explosion pulses, strikes) |
| `backgrounds` (`backgrounds/ui.json`) | Panels, grids, range ring, shockwave rings |
| `glitch` | Glitch effect strips |
| `infiltration` | Takeover terminal, baked from `mockups/infiltration-terminal.html` (see CLAUDE.md) |

Loose preload images (`imageFilesPreload`): `white_pixel`, `black_pixel`, loading background.

## Audio (`assets/audioFiles.js`)

About 60 sounds. Register a key there, play with `audio.play('key', vol)` / `audio.playMusic('key')`.
The `add-audio` skill walks through it; `npm run audit-assets` checks registrations against code.

## Fonts

TTF web fonts in `assets/fonts/`, declared with `@font-face` in `styles.css` and pre-warmed by
hidden spans in `index.html` (so Phaser text has them on first draw):

| Family | Used for |
|---|---|
| `Quantico-Regular`, `Quantico-Bold`, `Quantico-Italic` | Most UI and game text |
| `Michroma` | Results-screen titles (`iterationOverScreen.js`) |
| `MunroSmall` | Pixel-style announcements and small numbers |

`assets/fontFiles.js` is for bitmap fonts and is currently empty. The boot-error button CSS in
`index.html` still asks for a `VCR` font that isn't in the repo (falls back to sans-serif).

## Adding assets

1. Put the file in `raw/<atlas>/` (sprites) or `assets/audio/`, `assets/fonts/`.
2. Sprites: republish the atlas's `raw/<name>.tps` in TexturePacker. Audio: register in `assets/audioFiles.js`.
3. Run `npm run audit-assets`.
