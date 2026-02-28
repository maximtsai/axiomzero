## Fonts (`assets/fonts/`)
| Family | File | Weights |
|--------|------|---------|
| Michroma | Michroma_Regular.ttf | Regular |
| JetBrainsMono_Regular | JetBrainsMono_Regular.ttf | Regular |
| JetBrainsMono_Bold | JetBrainsMono_Bold.ttf | Bold |
| JetBrainsMono_Italic | JetBrainsMono_Italic.ttf | Italic |
| VCR | VCR.ttf | Regular |

### `assets/fontFiles.js`
Declared via @font-face in `index.html`.

## Adding New Assets

1. Add to appropriate folder (`assets/sprites/`, `assets/audio/`, etc.)
2. Update corresponding `assets/*.js` file
3. For atlases: update the TexturePacker `.tps` file in `raw/` and re-export
