Run the UglifyJS build to regenerate `js/util/utilities.js` from the source files in `js/util/`.

Use the Bash tool to run this exact command from the `js/util/` directory:

```sh
cd js/util && uglifyjs messageBus.js debugManager.js mouseManager.js audioManager.js tweens.js objectPool.js button.js buttonManager.js typewriterHelper.js effectPool.js uiHelper.js textEffects.js timeManager.js updateManager.js popupManager.js virtualGroup.js -o utilities.js -c -m
```

After running, confirm whether it succeeded or report any errors.
