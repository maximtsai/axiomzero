// js/swordAttack.js — Sword stabbing attack from the tower.
// Deals damage in a line towards the closest enemy every 2s.

class SwordAttackModel {
    constructor() {
        this.FIRE_INTERVAL = 2000;
        this.BASE_DAMAGE = 25;
        this.SEARCH_RANGE = 400;
        this.BASE_LENGTH = 200;
        this.START_OFFSET = 20;
        this.DAMAGE_START_OFFSET = 25;
        this.ATTACK_WIDTH = 60;
        this.FLURRY_WIDTH = 55;
        this.TIP_WIDTH = 30;
        this.LENGTH_SPRITE_WIDTH = 100;
        this.FLURRY_DAMAGE_MULT = 0.6;

        this.active = false;
        this.unlocked = false;
        this.paused = false;
        this.damage = this.BASE_DAMAGE;
        this.targetLength = this.BASE_LENGTH;
        this.lungeLevel = 0;
        this.flurryLevel = 0;
        this.fireTimer = 1000; // 1000ms lead
        this.isAttacking = false;
        this.rotation = 0;
    }

    resetTimer() {
        this.fireTimer = 1000;
        this.isAttacking = false;
    }

    updateTimer(delta) {
        this.fireTimer += delta;
        if (this.fireTimer >= this.FIRE_INTERVAL) {
            return true;
        }
        return false;
    }
}

class SwordAttackView {
    constructor() {
        this.stems = []; // { container, length, tip, tweens[], inUse }
        this.config = { startOffset: 0, tipWidth: 0, lengthSpriteWidth: 0 };
        this.hitCircle = new Phaser.Geom.Circle(); // Shared object to reduce GC
        this.slashPool = null;
    }

    init(config) {
        this.config = config;

        // Clean up existing stems if re-initializing
        if (this.stems.length > 0) {
            this.hide();
            this.stems.forEach(s => s.container.destroy());
            this.stems = [];
        }

        // Pre-allocate 3 stems (1 main + 2 flurries)
        for (let i = 0; i < 3; i++) {
            const container = PhaserScene.add.container(0, 0);
            container.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES + 11);
            container.setAlpha(0);
            container.setVisible(false);

            const length = PhaserScene.add.image(config.startOffset, 0, 'player', 'sword_length.png');
            length.setOrigin(0, 0.5);
            length.scaleX = 0;

            const tip = PhaserScene.add.image(config.startOffset, 0, 'player', 'sword_tip.png');
            tip.setOrigin(0, 0.5);

            container.add([length, tip]);
            this.stems.push({
                container,
                length,
                tip,
                tweens: [],
                inUse: false
            });
        }
    }

    playAttack(startRotation, targetRotation, targetLength, onDamage, onComplete, scaleY = 1.0, alphaOutDelay = 0) {
        // Find an available stem from the pool
        const stem = this.stems.find(s => !s.inUse);
        if (!stem) return;
        stem.inUse = true;
        const { container, length, tip } = stem;

        const pos = tower.getPosition();
        container.setPosition(pos.x, pos.y);
        container.setRotation(startRotation);
        container.setScale(1, scaleY);
        container.setAlpha(0);
        container.setVisible(true);

        length.x = this.config.startOffset;
        length.scaleX = 0;
        tip.x = this.config.startOffset;

        const releaseStem = () => {
            stem.tweens.forEach(t => t.stop());
            stem.tweens = [];
            container.setVisible(false);
            container.setAlpha(0);
            stem.inUse = false;
            if (onComplete) onComplete();
        };

        // Alpha Tween
        const alphaIn = PhaserScene.tweens.add({
            targets: container,
            alpha: 1,
            duration: 170,
            ease: 'Linear',
            onComplete: () => {
                const totalExtend = targetLength - (this.config.startOffset + this.config.tipWidth) - 5;
                const targetScaleX = totalExtend / this.config.lengthSpriteWidth;

                const lungeIn = PhaserScene.tweens.add({
                    targets: length,
                    scaleX: targetScaleX + 0.25,
                    duration: 100,
                    ease: 'Cubic.easeIn',
                    onUpdate: () => {
                        tip.x = this.config.startOffset + length.scaleX * this.config.lengthSpriteWidth;
                    },
                    onComplete: () => {
                        onDamage();

                        const alphaOut = PhaserScene.tweens.add({
                            targets: container,
                            alpha: 0,
                            duration: 500,
                            delay: alphaOutDelay,
                            ease: 'Cubic.easeIn',
                            onComplete: releaseStem
                        });
                        stem.tweens.push(alphaOut);

                        const lungeOut = PhaserScene.tweens.add({
                            targets: length,
                            scaleX: targetScaleX,
                            duration: 220,
                            ease: 'Back.easeOut',
                            onUpdate: () => {
                                tip.x = this.config.startOffset + length.scaleX * this.config.lengthSpriteWidth;
                            },
                        });
                        stem.tweens.push(lungeOut);
                    }
                });
                stem.tweens.push(lungeIn);
            }
        });
        stem.tweens.push(alphaIn);

        // Rotation Tween
        if (startRotation !== targetRotation) {
            const rotTween = PhaserScene.tweens.add({
                targets: container,
                rotation: targetRotation,
                duration: 210,
                ease: 'Cubic.easeOut',
            });
            stem.tweens.push(rotTween);
        }
    }

    hide() {
        this.stems.forEach(stem => {
            stem.tweens.forEach(t => t.stop());
            stem.tweens = [];
            stem.container.setVisible(false);
            stem.container.setAlpha(0);
            stem.inUse = false;
        });
    }

    updatePosition(x, y) {
        this.stems.forEach(stem => {
            if (stem.inUse) {
                stem.container.setPosition(x, y);
            }
        });
    }
}

const swordAttack = (() => {
    const model = new SwordAttackModel();
    const view = new SwordAttackView();

    function init() {
        view.init({
            startOffset: model.START_OFFSET,
            tipWidth: model.TIP_WIDTH,
            lengthSpriteWidth: model.LENGTH_SPRITE_WIDTH
        });

        view.slashPool = new ObjectPool(
            () => {
                const s = PhaserScene.add.image(0, 0, 'player', 'slash.png');
                s.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES + 12);
                s.setAlpha(0);
                s.setVisible(false);
                return s;
            },
            (s) => {
                s.setVisible(false);
                s.setAlpha(0);
            },
            20
        );

        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('gamePaused', () => { model.paused = true; });
        messageBus.subscribe('gameResumed', () => { model.paused = false; });
        messageBus.subscribe('testingDefensesStarted', () => { model.resetTimer(); });
        messageBus.subscribe('testingDefensesEnded', () => { model.resetTimer(); });
        updateManager.addFunction(_update);
    }

    function unlock() {
        model.unlocked = true;
        if (gameStateMachine.getPhase() === GAME_CONSTANTS.PHASE_COMBAT) {
            model.active = true;
            model.resetTimer();
        }
    }

    function lock() {
        model.unlocked = false;
        model.active = false;
        model.isAttacking = false;
        view.hide();
    }

    function _update(delta) {
        const isTesting = typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses;
        if (!model.unlocked || model.paused || (!model.active && !isTesting) || !tower.isAlive()) return;

        const pos = tower.getPosition();
        view.updatePosition(pos.x, pos.y);

        if (model.updateTimer(delta)) {
            _attemptFire();
        }
    }

    function _attemptFire() {
        if (model.isAttacking) return;

        const pos = tower.getPosition();
        const enemies = enemyManager.getEnemiesInRange(pos.x, pos.y, model.SEARCH_RANGE);
        if (!enemies || enemies.length === 0) {
            model.fireTimer = 0;
            return;
        }

        // Find closest enemy (taking size into account)
        let closest = null;
        let minDist = Infinity;
        for (const e of enemies) {
            if (!e.model.alive) continue;
            const dx = e.model.x - pos.x;
            const dy = e.model.y - pos.y;
            const centerDist = Math.sqrt(dx * dx + dy * dy);
            let edgeDist = centerDist - (e.model.size || 15);

            // Priority targeting: bosses and minibosses appear 30 units closer if they are in range
            if ((e.model.isBoss || e.model.isMiniboss) && edgeDist <= model.SEARCH_RANGE) {
                edgeDist = Math.max(0, edgeDist - 30);
            }

            if (edgeDist < minDist) {
                minDist = edgeDist;
                closest = e;
            }
        }

        if (closest) {
            model.fireTimer -= model.FIRE_INTERVAL;
            _fireSequence(closest);
        } else {
            model.fireTimer = 0;
        }
    }

    function _fireSequence(target) {
        model.isAttacking = true;
        const currentFlurryLevel = model.flurryLevel;

        const pos = tower.getPosition();
        const targetAngle = Math.atan2(target.model.y - pos.y, target.model.x - pos.x);

        // --- Main Attack ---
        const diff = Phaser.Math.Angle.ShortestBetween(model.rotation, targetAngle);
        const startRotation = model.rotation + diff * 0.5;
        const finalRotation = model.rotation + diff;

        view.playAttack(
            startRotation,
            finalRotation,
            model.targetLength,
            () => {
                _applyHit(targetAngle, model.targetLength, 1.0, null, false);
                model.rotation = Phaser.Math.Angle.Wrap(finalRotation);
            },
            () => { model.isAttacking = false; },
            1.0,
            currentFlurryLevel > 0 ? 200 : 50
        );

        // --- Flurry Attacks ---
        if (currentFlurryLevel > 0) {
            const flurryDamageMult = model.FLURRY_DAMAGE_MULT;
            const flurryLength = model.targetLength * 0.667;

            // First Flurry: 250ms delay, -0.375 radians
            PhaserScene.time.delayedCall(250, () => {
                const angle1 = targetAngle - 0.375;
                view.playAttack(
                    angle1,
                    angle1,
                    flurryLength,
                    () => { _applyHit(angle1, flurryLength, flurryDamageMult, model.FLURRY_WIDTH, true); },
                    () => { },
                    0.9,
                    50
                );
            });

            // Second Flurry: 400ms delay, +0.375 radians
            PhaserScene.time.delayedCall(400, () => {
                const angle2 = targetAngle + 0.375;
                view.playAttack(
                    angle2,
                    angle2,
                    flurryLength,
                    () => { _applyHit(angle2, flurryLength, flurryDamageMult, model.FLURRY_WIDTH, true); },
                    () => { },
                    0.9,
                    0
                );
            });
        }
    }

    function _applyHit(angle, length, damageMult = 1.0, widthOverride = null, isFlurry = false) {
        const pos = tower.getPosition();
        const startX = pos.x + Math.cos(angle) * model.DAMAGE_START_OFFSET;
        const startY = pos.y + Math.sin(angle) * model.DAMAGE_START_OFFSET;
        const endX = pos.x + Math.cos(angle) * length;
        const endY = pos.y + Math.sin(angle) * length;

        const line = new Phaser.Geom.Line(startX, startY, endX, endY);
        const hitEnemies = [];

        // Feedback
        if (typeof audio !== 'undefined') {
            const isLite = damageMult < 1.0;
            const soundKey = isLite ? 'sword_stab_lite' : 'sword_stab';
            const s = audio.play(soundKey, 0.6 * damageMult);
            if (s) {
                s.detune = Phaser.Math.Between(100, 300);
                if (isLite) {
                    s.detune -= 400; // Compensate for the 35% higher base pitch
                }
            }
        }

        const enemies = enemyManager.getEnemiesInRange(pos.x, pos.y, length + 50);
        const currentWidth = widthOverride !== null ? widthOverride : model.ATTACK_WIDTH;
        const halfWidth = currentWidth / 2;

        for (const e of enemies) {
            if (!e.model.alive) continue;

            view.hitCircle.setTo(e.model.x, e.model.y, (e.model.size || 15) + halfWidth);
            if (Phaser.Geom.Intersects.LineToCircle(line, view.hitCircle)) {
                enemyManager.damageEnemy(e, model.damage * damageMult, 'sword');
                hitEnemies.push(e);
            }
        }

        // Slash animation: Spawn slash sprites at the contact points
        if (hitEnemies.length > 0 && view.slashPool) {
            const nearestPoint = { x: 0, y: 0 };

            for (const e of hitEnemies) {
                Phaser.Geom.Line.GetNearestPoint(line, e.model, nearestPoint);

                const dx = e.model.x - nearestPoint.x;
                const dy = e.model.y - nearestPoint.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                const quarterWidth = halfWidth * 0.5;
                const px = nearestPoint.x + (dx / dist) * quarterWidth;
                const py = nearestPoint.y + (dy / dist) * quarterWidth;

                const slash = view.slashPool.get();
                if (slash) {
                    slash.setPosition(px, py);
                    slash.setRotation(Math.random() * Math.PI * 2);
                    slash.setAlpha(1);
                    if (isFlurry) {
                        slash.setScale(0.6, 0.45);
                    } else {
                        slash.setScale(0.8, 0.6);
                    }
                    slash.setVisible(true);

                    // Animation
                    let randomScaleUp = Math.random();
                    let endScaleX = isFlurry ? 1.4 + randomScaleUp * 0.4 : 2.2 + randomScaleUp * 0.8;
                    let flurryDurationBonus = isFlurry ? -50 : 0;

                    PhaserScene.tweens.add({
                        targets: slash,
                        scaleX: endScaleX,
                        duration: 260 + flurryDurationBonus,
                    });
                    PhaserScene.tweens.add({
                        targets: slash,
                        scaleY: isFlurry ? 0.9 : 1.25,
                        duration: 60,
                        ease: 'Cubic.easeOut',
                        onComplete: () => {
                            PhaserScene.tweens.add({
                                targets: slash,
                                scaleY: 0,
                                duration: 200 + flurryDurationBonus,
                                ease: 'Cubic.easeIn',
                            });
                        }
                    });

                    PhaserScene.tweens.add({
                        targets: slash,
                        alpha: 0,
                        duration: 100,
                        delay: 160 + flurryDurationBonus,
                        ease: 'Quad.easeIn',
                        onComplete: () => {
                            view.slashPool.release(slash);
                        }
                    });
                }
            }
        }

        return hitEnemies;
    }

    function _onPhaseChanged(phase) {
        const isCombat = phase === GAME_CONSTANTS.PHASE_COMBAT;
        if (isCombat && model.unlocked) {
            model.active = true;
            model.resetTimer();
        } else {
            model.active = false;
            model.isAttacking = false;
            view.hide();
        }
    }

    function setDamage(dmg) { model.damage = dmg; }
    function setLength(len) { model.targetLength = len; }
    function setLungeLevel(lv) {
        model.lungeLevel = lv;
        model.targetLength = model.BASE_LENGTH * (1 + lv * 0.25);
    }
    function setFlurryLevel(lv) {
        model.flurryLevel = lv;
    }

    return { init, unlock, lock, setDamage, setLength, setLungeLevel, setFlurryLevel };
})();
