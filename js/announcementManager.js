// announcementManager.js
// Handles centered transition messages (Boss/Regular) with typewriter and glitch effects.

const announcementManager = (() => {

    function init() {
        messageBus.subscribe('AnnounceText', showAnnounceMessage);
        messageBus.subscribe('BossAnnounceText', ({ msg1, msg2 }) => showBossAnnouncement(msg1, msg2));
    }

    /**
     * Show a centered transition message using a typewriter effect.
     * @param {string} msg1 
     * @param {string} msg2
     */
    function showBossAnnouncement(msg1, msg2) {
        const baseSize = (gameState.settings.bigFont ? 56 : 50);
        const fSize1 = Math.floor(baseSize * 0.8) + 'px';
        const fSize2 = Math.floor(baseSize * 1.5) + 'px';

        // 1. Measure both pieces for overall centering
        const tempTxt1 = PhaserScene.add.text(0, 0, msg1, { fontFamily: 'MunroSmall', fontSize: fSize1 });
        const tempTxt2 = PhaserScene.add.text(0, 0, msg2, { fontFamily: 'MunroSmall', fontSize: fSize2 });
        const h1 = tempTxt1.height;
        const h2 = tempTxt2.height;
        const totalHeight = h1 + h2 + 4; // 4px spacing
        const maxWidth = Math.max(tempTxt1.width, tempTxt2.width);
        tempTxt1.destroy();
        tempTxt2.destroy();

        const baseYPos = GAME_CONSTANTS.halfHeight - 320;
        const commonX = GAME_CONSTANTS.halfWidth;

        // Message 1 (Status)
        const txt1 = PhaserScene.add.text(commonX, baseYPos - totalHeight / 2, '', {
            fontFamily: 'MunroSmall',
            fontSize: fSize1,
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5, 0).setDepth(GAME_CONSTANTS.DEPTH_HUD + 10).setAlpha(1).setShadow(1, 2, '#000000', 4, true, true);

        // Message 2 (Boss Name)
        const txt2 = PhaserScene.add.text(commonX, txt1.y + h1 - 5, '', {
            fontFamily: 'MunroSmall',
            fontSize: fSize2,
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 6,
        }).setOrigin(0.5, 0).setDepth(GAME_CONSTANTS.DEPTH_HUD + 10).setAlpha(1).setShadow(2, 3, '#000000', 8, true, true);

        // Decorative Line (centered between them or below)
        const line = PhaserScene.add.image(commonX, txt2.y + h2 + 10, 'ui', 'white_line.png');
        line.setDepth(GAME_CONSTANTS.DEPTH_HUD + 9).setAlpha(0).setScale(0, 1.0);

        // Line Animation
        PhaserScene.tweens.add({
            delay: 400,
            targets: line,
            scaleX: (maxWidth / line.width) * 1.2 + 0.5,
            alpha: 1,
            duration: 800,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: line,
                    alpha: 0.7,
                    duration: 1000,
                    yoyo: true,
                    repeat: -1
                });
            }
        });

        // Global Glitch/Glow effects
        audio.play('data_reveal', 1.0);

        PhaserScene.time.delayedCall(1200, () => {
            if (txt2.active) {
                glitchFX.triggerChromaticAberration(txt2, 700, 2.5);
                glitchFX.triggerAnnounceGlow(commonX, txt1.y + totalHeight / 2, 1600, totalHeight + 100);
            }
        });

        // Typewriter Logic Staged
        let idx1 = 0;
        let idx2 = 0;

        const type2 = () => {
            if (!txt2.scene) return;
            if (idx2 >= msg2.length) {
                _finalizeAnnouncement();
                return;
            }
            txt2.text += msg2[idx2++];
            PhaserScene.time.delayedCall(25, type2);
        };

        const type1 = () => {
            if (!txt1.scene) return;
            if (idx1 >= msg1.length) {
                PhaserScene.time.delayedCall(475, type2);
                return;
            }
            txt1.text += msg1[idx1++];
            PhaserScene.time.delayedCall(20, type1);
        };

        const _finalizeAnnouncement = () => {
            const linger = 4100;
            PhaserScene.time.delayedCall(linger, () => {
                if (!txt1.scene) return;
                [txt1, txt2, line].forEach(obj => {
                    PhaserScene.tweens.add({
                        targets: obj,
                        alpha: 0,
                        duration: 800,
                        onComplete: () => obj.destroy()
                    });
                });
            });
        };

        type1();
    }

    function showAnnounceMessage(msg) {
        const fSize = (gameState.settings.bigFont ? 56 : 50) + 'px';
        const measureMsg = msg.replaceAll('#', '');
        const tempTxt = PhaserScene.add.text(0, 0, measureMsg, {
            fontFamily: 'MunroSmall',
            fontSize: fSize,
        });
        const fullWidth = tempTxt.width;
        const fullHeight = tempTxt.height;
        tempTxt.destroy();

        const baseYPos = GAME_CONSTANTS.halfHeight - 310;
        const txt = PhaserScene.add.text(GAME_CONSTANTS.halfWidth - (fullWidth / 2), baseYPos - (fullHeight * 0.5), '', {
            fontFamily: 'MunroSmall',
            fontSize: fSize,
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 4,
            lineSpacing: -4
        }).setOrigin(0, 0).setDepth(GAME_CONSTANTS.DEPTH_HUD + 10).setAlpha(1).setShadow(1, 2, '#000000', 6, true, true);

        const line = PhaserScene.add.image(GAME_CONSTANTS.halfWidth, txt.y + fullHeight + 10, 'ui', 'white_line.png');
        line.setDepth(GAME_CONSTANTS.DEPTH_HUD + 9).setAlpha(0).setScale(0, 1.0);

        PhaserScene.tweens.add({
            delay: 600,
            targets: line,
            scaleX: 4,
            alpha: 1,
            duration: 600,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: line,
                    alpha: 0.8,
                    duration: 800,
                });
            }
        });

        audio.play('data_reveal', 0.8);

        PhaserScene.time.delayedCall(750, () => {
            if (txt.active) {
                glitchFX.triggerChromaticAberration(txt, 600, 1.75);
            }
        });
        PhaserScene.time.delayedCall(250, () => {
            if (txt.active) {
                glitchFX.triggerAnnounceGlow(GAME_CONSTANTS.halfWidth, txt.y + fullHeight / 2, 1200, fullHeight + 30);
            }
        });

        let charIdx = 0;

        const typeChar = () => {
            if (!txt.scene) return;

            if (charIdx >= msg.length) {
                _transitionMessageDone();
                return;
            }

            const char = msg[charIdx];
            if (char === '#') {
                charIdx++;
                PhaserScene.time.delayedCall(400, typeChar);
            } else {
                txt.text += char;
                charIdx++;
                PhaserScene.time.delayedCall(25, typeChar);
            }
        };

        const _transitionMessageDone = () => {
            const baseX = txt.x;
            const baseY = txt.y;
            const lineBaseX = line.x;
            const lineBaseY = line.y;

            const lingerTime = msg.includes('\n') ? 3400 : 2850;
            PhaserScene.time.delayedCall(lingerTime, () => {
                let jitterCount = 0;
                const jitterTotal = 8;
                const jitterEvent = PhaserScene.time.addEvent({
                    delay: 35,
                    repeat: jitterTotal - 1,
                    callback: () => {
                        jitterCount++;
                        const ox = (Math.random() - 0.5) * 12;
                        const oy = (Math.random() - 0.5) * 6;
                        txt.x = baseX + ox;
                        txt.y = baseY + oy;
                        line.x = lineBaseX + ox;
                        line.y = lineBaseY + oy;

                        const flickAlpha = 0.5 + Math.random() * 0.5;
                        txt.setAlpha(flickAlpha);
                        line.setAlpha(flickAlpha);
                    }
                });

                PhaserScene.time.delayedCall(180, () => {
                    txt.setAlpha(0.3);
                    line.setAlpha(0.3);
                    const ox = (Math.random() - 0.5) * 18;
                    txt.x = baseX + ox;
                    line.x = lineBaseX + ox;
                    PhaserScene.time.delayedCall(30, () => {
                        txt.setAlpha(0.85);
                        line.setAlpha(0.85);
                        txt.x = baseX;
                        txt.y = baseY;
                        line.x = lineBaseX;
                        line.y = lineBaseY;
                    });
                });

                PhaserScene.time.delayedCall(350, () => {
                    txt.setAlpha(0.3);
                    line.setAlpha(0.3);
                    const ox = (Math.random() - 0.5) * 18;
                    txt.x = baseX + ox;
                    line.x = lineBaseX + ox;
                    PhaserScene.time.delayedCall(30, () => {
                        txt.setAlpha(0.85);
                        line.setAlpha(0.85);
                        txt.x = baseX;
                        txt.y = baseY;
                        line.x = lineBaseX;
                        line.y = lineBaseY;
                    });
                });

                PhaserScene.time.delayedCall(jitterTotal * 35 + 10, () => {
                    txt.x = baseX;
                    txt.y = baseY;
                    txt.setAlpha(1);
                    line.x = lineBaseX;
                    line.y = lineBaseY;
                    line.setAlpha(1);

                    PhaserScene.time.delayedCall(400, () => {
                        txt.setOrigin(0.5, 0.5);
                        txt.x = GAME_CONSTANTS.halfWidth + 60;
                        txt.y = baseYPos;
                        txt.setAlpha(0.65);
                        txt.setScale(1.4, 0.8);

                        line.x = GAME_CONSTANTS.halfWidth + 60;
                        line.setAlpha(0.65);
                        line.setScale(4.2, 0.4);

                        PhaserScene.time.delayedCall(30, () => {
                            txt.x = GAME_CONSTANTS.halfWidth - 50;
                            txt.setAlpha(0.45);
                            txt.setScale(3.2, 0.2);

                            line.x = GAME_CONSTANTS.halfWidth - 50;
                            line.setAlpha(0.45);
                            line.setScale(10, 0.1);

                            PhaserScene.time.delayedCall(35, () => {
                                txt.destroy();
                                line.destroy();
                            });
                        });
                    });
                });
            });
        };

        typeChar();
    }

    return { init, showAnnounceMessage, showBossAnnouncement };
})();
