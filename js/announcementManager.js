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
            const targets = [
                { ref: txt1, x: txt1.x, y: txt1.y },
                { ref: txt2, x: txt2.x, y: txt2.y },
                { ref: line, x: line.x, y: line.y }
            ];
            _runGlitchOut(targets, linger);
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
            _runGlitchOut([
                { ref: txt, x: txt.x, y: txt.y },
                { ref: line, x: line.x, y: line.y }
            ], msg.includes('\n') ? 3400 : 2850);
        };

        typeChar();
    }

    /**
     * Internal helper to perform high-impact glitch disappearance for HUD text.
     */
    function _runGlitchOut(targets, lingerTime) {
        PhaserScene.time.delayedCall(lingerTime, () => {
            if (!targets[0].ref.scene) return;

            // 1. Initial Jitter & Flicker
            let jitterCount = 0;
            const jitterTotal = 8;
            const jitterEvent = PhaserScene.time.addEvent({
                delay: 35,
                repeat: jitterTotal - 1,
                callback: () => {
                    jitterCount++;
                    const ox = (Math.random() - 0.5) * 12;
                    const oy = (Math.random() - 0.5) * 6;
                    const flickAlpha = 0.5 + Math.random() * 0.5;

                    targets.forEach(t => {
                        if (t.ref.scene) {
                            t.ref.x = t.x + ox;
                            t.ref.y = t.y + oy;
                            t.ref.setAlpha(flickAlpha);
                        }
                    });
                }
            });

            // 2. Mid Glitch horizontal stabs
            [180, 350].forEach(delay => {
                PhaserScene.time.delayedCall(delay, () => {
                    const ox = (Math.random() - 0.5) * 18;
                    targets.forEach(t => {
                        if (t.ref.scene) {
                            t.ref.setAlpha(0.3);
                            t.ref.x = t.x + ox;
                        }
                    });
                    PhaserScene.time.delayedCall(30, () => {
                        targets.forEach(t => {
                            if (t.ref.scene) {
                                t.ref.setAlpha(0.85);
                                t.ref.x = t.x;
                            }
                        });
                    });
                });
            });

            // 3. Final smear and destroy
            PhaserScene.time.delayedCall(jitterTotal * 35 + 10, () => {
                targets.forEach(t => {
                    if (t.ref.scene) {
                        t.ref.x = t.x;
                        t.ref.y = t.y;
                        t.ref.setAlpha(1);
                    }
                });

                PhaserScene.time.delayedCall(400, () => {
                    targets.forEach(t => {
                        if (t.ref.scene) {
                            // Smear 1
                            if (t.ref.setOrigin) t.ref.setOrigin(0.5, 0.5);
                            t.ref.x = t.x + 60;
                            t.ref.setAlpha(0.65);
                            t.ref.setScale(t.ref.scaleX * 1.4, t.ref.scaleY * 0.8);
                        }
                    });

                    PhaserScene.time.delayedCall(30, () => {
                        targets.forEach(t => {
                            if (t.ref.scene) {
                                // Smear 2
                                t.ref.x = t.x - 50;
                                t.ref.setAlpha(0.45);
                                t.ref.setScale(t.ref.scaleX * 2.5, t.ref.scaleY * 0.3);
                            }
                        });

                        PhaserScene.time.delayedCall(35, () => {
                            targets.forEach(t => {
                                if (t.ref.scene) t.ref.destroy();
                            });
                        });
                    });
                });
            });
        });
    }



    return { init, showAnnounceMessage, showBossAnnouncement };
})();
