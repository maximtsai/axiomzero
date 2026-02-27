Bundle and minify utility modules into js/util/utilities.js.

CONTEXT: This project uses plain JS with script tags (no bundler). The js/util/ directory contains individual source files that must be combined into a single utilities.js file using UglifyJS. This is required whenever js/util source files are edited. The bundle is loaded by index.html in the load order and provides globals: messageBus, buttonManager, updateManager, audioManager (audio), button, buttonManager, tweens, helper, timeManager, popupManager, textEffects, virtualGroup, objectPool.

IMPORTANT: These files are loaded separately and NOT bundled: globals.js, loadingManager.js, gameState.js, debugManager.js, notificationManager.js.

COMMAND: Execute from js/util/ directory:
```sh
cd js/util && uglifyjs messageBus.js debugManager.js mouseManager.js audioManager.js tweens.js objectPool.js button.js buttonManager.js typewriterHelper.js effectPool.js uiHelper.js textEffects.js timeManager.js updateManager.js popupManager.js virtualGroup.js -o utilities.js -c -m
```

FLAGS: -c enables compression (remove whitespace, simplify code), -m enables name mangling (shorten variable names). Both are safe for this codebase since there are no external dependencies relying on these symbols.

VERIFICATION: After build completes successfully, verify utilities.js exists and contains the minified bundle. The file size should be significantly smaller than the combined source files. If errors occur, check that all input files exist and the command syntax matches exactly.
