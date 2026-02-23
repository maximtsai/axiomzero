// MainMenu - Handles all main menu UI elements
class MainMenu {
    constructor() {
        this.elements = {};
        this.isVisible = false;
        this.clearOnStartObjects = {};
    }

    // Create all main menu elements
    create(x, y) {
        // Store position for recreation
        this.x = x;
        this.y = y;

        // Create preload image

    }

    onLoadComplete(scene) {

        // Calculate center of remaining space
        let leftCenterX = (GAME_CONSTANTS.width - this.clearOnStartObjects.preloadImage.width) / 2;

        // Create "Maid Ready" text
        this.elements.loadingText = PhaserScene.add.text(leftCenterX, GAME_CONSTANTS.halfHeight - 45, 'Maid Ready', {
            fontFamily: 'CrimsonText_Bold',
            fontSize: 46,
            color: '#EBC99F',
            align: 'center',
            shadow: {
                color: '#000000',
                blur: 2,
                offsetX: 1,
                offsetY: 1,
                stroke: false,
                fill: true
            }
        }).setDepth(1001);
        this.elements.loadingText.setScale(0.6).setAlpha(0.93);
        this.elements.loadingText.setAlign('center');
        this.elements.loadingText.setOrigin(0.5, 0.5);
        this.elements.loadingText.scrollFactorX = 0.3;
        this.elements.loadingText.scrollFactorY = 0.3;

        // Create start button
        this.elements.startButton = new Button({
            normal: {
                atlas: 'buttons',
                ref: "menu_button.png",
                x: this.elements.loadingText.x,
                y: this.elements.loadingText.y + 50,
            },
            hover: {
                atlas: 'buttons',
                ref: "menu_button_hover.png",
                x: this.elements.loadingText.x,
                y: this.elements.loadingText.y + 50,
            },
            press: {
                atlas: 'buttons',
                ref: "menu_button_press.png",
                x: this.elements.loadingText.x,
                y: this.elements.loadingText.y + 50,
            },
            onMouseUp: () => {
                this.onStartClicked();
            }
        });
        this.elements.startButton.addText("START", {
            fontFamily: 'CrimsonText_Bold',
            fontSize: 24,
            color: '#F8DCB2',
            align: 'center'
        });
        this.elements.startButton.setAlpha(0);
        this.elements.startButton.setTextOffset(0, -1);

        // Fade in start button
        this.elements.startButton.tweenToAlpha(1, 1000, 'Quart.easeOut');

        // Create and play intro video
        const videoScale = (GAME_CONSTANTS.height / 768) * 0.891;
        const videoDepth = 1;
        const loop = true;
        this.elements.currentVideo = videoManager.playVideo(
            PhaserScene,
            'maidIntro',
            this.clearOnStartObjects.preloadImage.x,
            this.clearOnStartObjects.preloadImage.y,
            videoScale,
            videoDepth,
            loop
        );
        this.elements.currentVideo.play();

        // Fade out preload image
        PhaserScene.tweens.add({
            targets: this.clearOnStartObjects.preloadImage,
            alpha: 0,
            duration: 750,
            onComplete: () => {
                this.clearOnStartObjects.preloadImage.destroy();
            }
        });

        playMusic('menu_music', 0.85, true);
        this.isVisible = true;
    }

    createOnStartObjects(scene) {
        this.clearOnStartObjects.preloadBackground = scene.add.image(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, 'bg').setDepth(-1);
        this.clearOnStartObjects.rightbg = scene.add.image(GAME_CONSTANTS.width, GAME_CONSTANTS.halfHeight, 'right_bg').setDepth(0).setOrigin(1, 0.5);


        this.clearOnStartObjects.preloadImage = scene.add.image(GAME_CONSTANTS.width, GAME_CONSTANTS.halfHeight, 'zzza').setDepth(1001).setScale(0.95);
        this.clearOnStartObjects.preloadImage.x = GAME_CONSTANTS.width - this.clearOnStartObjects.preloadImage.width * 0.5 - 28;

        this.clearOnStartObjects.portrait = scene.add.image(GAME_CONSTANTS.width, GAME_CONSTANTS.halfHeight, 'portrait').setDepth(1011);
        this.clearOnStartObjects.portrait.x = this.clearOnStartObjects.preloadImage.x - 4;

        this.clearOnStartObjects.vignette_right = scene.add.image(GAME_CONSTANTS.width, GAME_CONSTANTS.halfHeight, 'vignette_right').setDepth(1012).setOrigin(1, 0.5).setScale(2);

        this.clearOnStartObjects.divider = scene.add.image(0, GAME_CONSTANTS.halfHeight, 'divider').setDepth(1011).setScale(0.71);
        this.clearOnStartObjects.divider.x = this.clearOnStartObjects.preloadImage.x - this.clearOnStartObjects.preloadImage.width * 0.5 - 45

        this.clearOnStartObjects.disclaimerText = PhaserScene.add.text(
            loadObjects.loadingText.x,
            GAME_CONSTANTS.height - 32,
            "WARNING:\nContains NSFW and potentially disturbing content such as\nfurries, BDSM, extreme fetishes and AI generated imagery.\nViewer discretion is advised.",
            {
                fontFamily: 'Times New Roman',
                fontSize: 18,
                color: '#BE9D80',
                align: 'center',
                shadow: {
                    color: '#000000',
                    blur: 2,
                    offsetX: 1,
                    offsetY: 1,
                    stroke: false,
                    fill: true
                }
            }
        ).setDepth(1001).setAlpha(0).setScale(1, 0.97);
        this.clearOnStartObjects.disclaimerText.setOrigin(0.5, 1);

        // Fade in disclaimer
        PhaserScene.tweens.add({
            targets: this.clearOnStartObjects.disclaimerText,
            alpha: 1,
            duration: 1000,
            ease: 'Quart.easeOut'
        });

    }

    // Called when start button is clicked
    onStartClicked() {
        // Destroy start button
        if (this.elements.startButton) {
            this.elements.startButton.destroy();
            delete this.elements.startButton;
        }
        let tempBlackImage = PhaserScene.add.image(-1, GAME_CONSTANTS.halfHeight, 'black_pixel').setScale(0, 2000).setDepth(9999).setOrigin(0, 0.5);
        fadeAwayMusic(1500, undefined, () => {
            playMusic("victoriandance");
        })
        playSound('click');
        setTimeout(() => {
            playSound('whoosh');
        }, 1200);
        PhaserScene.tweens.add({
            targets: tempBlackImage,
            scaleX: GAME_CONSTANTS.halfWidth + 2,
            duration: 1100,
            ease: 'Quint.easeIn',
            delay: 400,
            onComplete: () => {
                this.handleTrueStartLogic();
                tempBlackImage.setOrigin(1, 0.5).setPosition(GAME_CONSTANTS.width + 1, GAME_CONSTANTS.halfHeight);
                PhaserScene.tweens.add({
                    targets: tempBlackImage,
                    scaleX: 0,
                    duration: 750,
                    ease: 'Cubic.easeOut',
                    onComplete: () => {
                        tempBlackImage.destroy();
                    }
                })
            }
        });

        if (this.clearOnStartObjects.disclaimerText) {
            PhaserScene.tweens.add({
                targets: this.clearOnStartObjects.disclaimerText,
                alpha: 0,
                duration: 550,
                ease: 'Quad.easeOut'
            });
        }

        // Animate Maid Ready text out
        if (this.elements.loadingText) {
            PhaserScene.tweens.add({
                targets: this.elements.loadingText,
                alpha: 0,
                duration: 350,
            });
            PhaserScene.tweens.add({
                targets: this.elements.loadingText,
                scaleY: 0,
                duration: 350,
                ease: 'Quad.easeOut'
            });
            PhaserScene.tweens.add({
                targets: this.elements.loadingText,
                scaleX: 4,
                duration: 350,
                ease: 'Quad.easeIn',
                onComplete: () => {
                    if (this.elements.loadingText) {
                        this.elements.loadingText.destroy();
                        delete this.elements.loadingText;
                    }
                }
            });
        }

        // Fade out disclaimer
        if (this.elements.disclaimerText) {
            PhaserScene.tweens.add({
                targets: this.elements.disclaimerText,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    if (this.elements.disclaimerText) {
                        this.elements.disclaimerText.destroy();
                        delete this.elements.disclaimerText;
                    }
                }
            });
        }

        // Fade out corner decorations
        const corners = ['cornerTL', 'cornerTR', 'cornerBR', 'cornerBL'];
        corners.forEach(corner => {
            if (this.elements[corner]) {
                PhaserScene.tweens.add({
                    targets: this.elements[corner],
                    alpha: 0,
                    duration: 300,
                    onComplete: () => {
                        if (this.elements[corner]) {
                            this.elements[corner].destroy();
                            delete this.elements[corner];
                        }
                    }
                });
            }
        });

        // Swap video
        if (this.elements.currentVideo) {
            const videoScale = (GAME_CONSTANTS.height / 768) * 0.891;
            this.elements.currentVideo = videoManager.swapVideo(
                PhaserScene,
                this.elements.currentVideo,
                'lifter',
                this.elements.currentVideo.x ? this.elements.currentVideo.x : GAME_CONSTANTS.width - 90,
                this.elements.currentVideo.y ? this.elements.currentVideo.y : GAME_CONSTANTS.halfHeight,
                videoScale,
                true,
                250
            );
        }

        this.isVisible = false;
    }

    // Destroy all main menu elements
    destroy() {
        for (let key in this.elements) {
            if (this.elements[key] && this.elements[key].destroy) {
                this.elements[key].destroy();
            }
        }
        this.elements = {};
        this.isVisible = false;
    }

    // Check if menu is currently visible
    isShowing() {
        return this.isVisible;
    }

    // This actually begins the game
    handleTrueStartLogic() {
        for (let obj in this.clearOnStartObjects) {
            this.clearOnStartObjects[obj].destroy();
        }
        videoManager.destroyVideo(this.elements.currentVideo);

        // Play start_clip, then when it finishes, play 0_wait in a loop
        const videoScale = 1;
        videoManager.playThenLoop(
            PhaserScene,
            'start_clip',
            'start_loop',
            GAME_CONSTANTS.mainVideoXPos,
            GAME_CONSTANTS.halfHeight,
            videoScale,
            1
        );

        setTimeout(() => {
            playSound('startchain');
        }, 100)
    }
}

// Create global instance
const mainMenu = new MainMenu();
