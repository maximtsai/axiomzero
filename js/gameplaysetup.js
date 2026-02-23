let canFinishLoading = false;
let canvas;

function setupLoadingBar(scene) {
    // Preloaded image on the right side - persists and fades out separately

    // Calculate center of remaining space (left of the image)
    // Image is at width - 80, so remaining space is from 0 to (width - 80 - image_half_width)
    // Approximate center of left space
    let leftCenterX = (GAME_CONSTANTS.halfWidth - 150);

    // Basic loading bar visual
    loadObjects.loadingText = scene.add.text(leftCenterX, GAME_CONSTANTS.halfHeight - 45, 'Loading...', {fontFamily: 'Times New Roman', fontSize: 36, color: '#FFFFFF', align: 'center'}).setDepth(1001);
    loadObjects.loadingText.setScale(0.6).setAlpha(0.93);
    loadObjects.loadingText.setAlign('center');
    loadObjects.loadingText.setOrigin(0.5, 0.5);
    loadObjects.loadingText.scrollFactorX = 0.3; loadObjects.loadingText.scrollFactorY = 0.3;
    loadObjects.loadingBarBack = scene.add.image(leftCenterX, GAME_CONSTANTS.halfHeight + 100, 'white_pixel').setAlpha(0.5);
    loadObjects.loadingBarMain = scene.add.image(leftCenterX, GAME_CONSTANTS.halfHeight + 100, 'white_pixel');

    loadObjects.loadingBarBack.setScale(GAME_CONSTANTS.LOADING_BAR_WIDTH, GAME_CONSTANTS.LOADING_BAR_HEIGHT);
    loadObjects.loadingBarMain.setScale(1, GAME_CONSTANTS.LOADING_BAR_HEIGHT);

    mainMenu.createOnStartObjects(PhaserScene)


    // Use centralized loading manager with progress callback for visual feedback
    loadingManager.setupMainLoading(
        scene,
        // On complete callback
        () => {
            recheckMuteState();
            onLoadComplete(scene);

            // Change loading text to "Maid Ready"

            // Create main menu - this handles all menu elements
            createMuteSFXButton(72, 27);
            createMuteMusicButton (27, 27);
            mainMenu.create(loadObjects.loadingText.x, loadObjects.loadingText.y);
            loadObjects.loadingText.destroy();

            // Destroy loading objects (preloadImage and loadingText are in clearOnStartObjects, not loadObjects)
            for (let i in loadObjects) {
                if (loadObjects[i] && loadObjects[i].destroy) {
                    loadObjects[i].destroy();
                }
            }

            // Start loading delayed videos in background
            if (typeof videoFilesDelayed !== 'undefined' && videoFilesDelayed.length > 0) {
                const totalDelayedVideos = videoFilesDelayed.length;
                let loadedDelayedVideos = 0;

                // Create loading progress text in bottom left
                const delayedLoadingText = PhaserScene.add.text(
                    10,
                    GAME_CONSTANTS.height - 10,
                    `LOADING EXTRA CONTENT (0/${totalDelayedVideos})`,
                    {
                        fontFamily: 'Times New Roman',
                        fontSize: 12,
                        color: '#FFFFFF',
                        align: 'left'
                    }
                ).setDepth(1002).setAlpha(0.5).setOrigin(0, 1);

                // Track each video as it loads (use once to auto-remove listener)
                videoFilesDelayed.forEach(videoData => {
                    PhaserScene.load.once('filecomplete-video-' + videoData.name, () => {
                        loadedDelayedVideos++;
                        delayedLoadingText.setText(`LOADING EXTRA CONTENT (${loadedDelayedVideos}/${totalDelayedVideos})`);

                        // If all videos loaded, destroy the text
                        if (loadedDelayedVideos >= totalDelayedVideos) {
                            PhaserScene.tweens.add({
                                targets: delayedLoadingText,
                                alpha: 0,
                                duration: 500,
                                onComplete: () => {
                                    delayedLoadingText.destroy();
                                }
                            });
                        }
                    });
                });

                // Start loading delayed videos
                videoManager.loadDelayedVideos(PhaserScene);
            }
        },
        // On progress callback - handles loading bar and text updates
        (progress, statusText) => {
            if (progress !== null && progress !== undefined) {
                loadObjects.loadingBarMain.scaleX = GAME_CONSTANTS.LOADING_BAR_WIDTH * progress;
            }
            if (statusText) {
                loadObjects.loadingText.setText(`Loading... (${statusText})`);
            }
        }
    );
}


function clickIntro() {
    GAME_VARS.runningIntro = true;

    PhaserScene.tweens.add({
        targets: PhaserScene.cameras.main,
        scrollX: 0,
        scrollY: 0,
        duration: 750,
        ease: 'Cubic.easeOut'
    });

    PhaserScene.tweens.add({
        targets: [loadObjects.loadingText2, loadObjects.loadingText3],
        alpha: 0,
        duration: 800,
        ease: 'Quad.easeOut'
    });


    if (gameOptions.skipIntroFull) {
        loadObjects.glowBG.alpha = 0;
        PhaserScene.tweens.add({
            targets: loadObjects.glowBG,
            alpha: 1,
            duration: 900,
            ease: 'Quart.easeIn',
            onComplete: () => {
                this.skipIntro();
            }
        });
        loadObjects.glowBG.setScale(14);

    } else {
        PhaserScene.tweens.add({
            delay: 1500,
            targets: loadObjects.glowBG,
            alpha: 1.25,
            scaleX: 14,
            scaleY: 14,
            duration: 500,
            ease: 'Quart.easeIn',
            onComplete: () => {
                cleanupIntro(PhaserScene);
            }
        });
    }

    loadObjects.skipIntroText = PhaserScene.add.text(GAME_CONSTANTS.width - 5, GAME_CONSTANTS.height - 5, getLangText('click_to_skip'), {fontFamily: 'verdana', fontSize: 18, color: '#FFFFFF', align: 'right'}).setDepth(1005).setAlpha(0).setOrigin(1, 1);
    loadObjects.whiteOverall = PhaserScene.add.image(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, 'white_pixel').setDepth(2000).setAlpha(0).setScale(1000);
    PhaserScene.tweens.add({
        targets: loadObjects.whiteOverall,
        alpha: 0.75,
        ease: 'Quad.easeIn',
        duration: 2100
    });
}

function cleanupIntro() {
    if (GAME_VARS.introFinished) {
        return;
    }
    GAME_VARS.introFinished = true;
    tempBG = PhaserScene.add.image(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, 'white_pixel').setScale(1000).setAlpha(0.85).setDepth(1002);
    PhaserScene.tweens.add({
        targets: tempBG,
        alpha: 0,
        duration: 750,
        onComplete: () => {
            tempBG.destroy();
        }
    });

    hideGlobalClickBlocker();
}

function setupGame() {
    canvas = game.canvas;
    if (GAME_VARS.started) {
        return;
    }

    GAME_VARS.started = true;

    createAnimations(PhaserScene);

    globalObjects.timeManager = new TimeManager();
    mainMenu.onLoadComplete();
}

function setupPlayer() {
    globalObjects.options = new Options(PhaserScene, GAME_CONSTANTS.width - 27, 27);
}

function handleGlobalKeyPresses() {
    globalObjects.currentOpenedPopups = [];
    messageBus.subscribe('toggleCancelScreen', () => {
        if (globalObjects.currentOpenedPopups.length > 0) {
            let topFunc = globalObjects.currentOpenedPopups[globalObjects.currentOpenedPopups.length - 1];
            let success = topFunc(false);
            if (success) {
                globalObjects.currentOpenedPopups.pop();
            }
        } else {
            globalObjects.options.showOptions();
        }
    });
}

function addPopup(closeFunc) {
    globalObjects.currentOpenedPopups.push(closeFunc);
}

function removePopup() {
    globalObjects.currentOpenedPopups.pop();
}


