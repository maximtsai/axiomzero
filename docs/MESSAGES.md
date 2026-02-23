# MessageBus Topics

## Active Topics

### Input Events
| Topic | Publisher | Arguments | Subscribers |
|-------|-----------|-----------|-------------|
| `pointerMove` | mouseManager | `x, y` | buttonManager, hoverTextManager |
| `pointerDown` | mouseManager | `x, y` | buttonManager, hoverTextManager |
| `pointerUp` | mouseManager | `x, y` | buttonManager |

## Unused/Orphaned Topics

### Published but no subscribers
| Topic | Publisher | File:Line |
|-------|-----------|-----------|
| `assetsLoaded` | loadingScreen.js | 147, 151 |
| `toggleCancelScreen` | (none - file not loaded) | gameplaysetup.js:201 |

### Subscribed but never published
| Topic | Subscriber | File:Line |
|-------|------------|-----------|
| `tempPause` | timeManager | 6 |
| `pauseGame` | timeManager | 7 |
| `setGameSlow` | timeManager | 8 |
| `clearGameSlow` | timeManager | 9 |
| `unpauseGame` | timeManager | 10 |

## Usage

```js
// Subscribe
const sub = messageBus.subscribe('pointerUp', (x, y) => {
    console.log('Clicked at', x, y);
});
sub.unsubscribe();

// Publish
messageBus.publish('pointerUp', 100, 200);
```

## Best Practices

1. Always unsubscribe when done: `sub.unsubscribe()`
2. Use `messageBus.hasSubscribers(topic)` to check before publishing
3. Keep payloads minimal - pass IDs or references, not full objects
