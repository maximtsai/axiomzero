// artilleryAttack.js — Heavy strike weapon (Refactored to MVC)
// Activated by "artillery" node in Duo Tier 3.
// Hits a random spot every 6 seconds.

class ArtilleryAttackModel {
    constructor() {
        this.FIRE_INTERVAL = 6000; // 6 seconds
        this.BASE_DAMAGE = 30;
        this.BASE_SIZE = 315; // px — damage area side length (square)

        this.active = false;  // true when combat phase AND node purchased
        this.unlocked = false; // true after artillery node purchased
        this.paused = false;
        this.fireTimer = 0;

        this.setTargetingMargins(this.BASE_SIZE);

        // Upgrade levels
        this.radiusLevel = 0;     // artillery_shells
        this.volleyLevel = 0;     // artillery_volley
        this.firstStrikeLevel = 0; // artillery_first_strike
        this.stunLevel = 0;        // artillery_stun
    }

    updateTimer(delta) {
        if (!this.active || this.paused) return false;
        this.fireTimer += delta;
        if (this.fireTimer >= this.FIRE_INTERVAL) {
            this.fireTimer -= this.FIRE_INTERVAL;
            return true;
        }
        return false;
    }

    getDamageArea() {
        // Increases size by 10% per level
        return this.BASE_SIZE * (1 + 0.1 * this.radiusLevel);
    }

    setTargetingMargins(n) {
        this.SCREEN_BORDER_WIDTH = n;
        this.SCREEN_BORDER_HEIGHT = n * 0.6;
        this.TOWER_MARGIN = n + 10;
    }
}

class ArtilleryAttackView {
    constructor() {
        this.CORNER_SIZE = 30;
        this._strikePool = [];
    }

    init() {
        // Pre-allocate 6 strikes (sufficient for Triple Volley + overlaps)
        for (let i = 0; i < 6; i++) {
            const obj = this._createStrikeObject(315);
            this._strikePool.push(obj);
        }
    }

    update(delta) {
        for (let i = 0; i < this._strikePool.length; i++) {
            const obj = this._strikePool[i];
            if (!obj.inUse) continue;

            const base = obj.base;
            const rotAccel = base.rotation * -0.1 - obj.rotVel * 0.25;
            obj.rotVel += rotAccel;
            base.rotation += obj.rotVel * delta * 0.14;

            obj.center.setRotation(base.rotation);
            obj.bright.setRotation(base.rotation);
            // Red stays with its own random initial rotation or follows? 
            // In cursor, only base and bright are synced. Red is set once.
            // But let's sync red too if it looks better, or leave it.
            // I'll sync red too for artillery since it's a static area.
            obj.red.setRotation(base.rotation * 0.5);
        }
    }

    /** 
     * Internal: factory for strike objects.
     */
    _createStrikeObject(size) {
        const obj = {
            inUse: false,
            base: PhaserScene.add.nineslice(0, 0, 'player', 'artillery.png', size, size, this.CORNER_SIZE, this.CORNER_SIZE, this.CORNER_SIZE, this.CORNER_SIZE),
            center: PhaserScene.add.image(0, 0, 'player', 'artillery_center.png'),
            bright: PhaserScene.add.nineslice(0, 0, 'player', 'artillery_bright.png', size, size, this.CORNER_SIZE, this.CORNER_SIZE, this.CORNER_SIZE, this.CORNER_SIZE),
            red: PhaserScene.add.nineslice(0, 0, 'player', 'artillery_red.png', size, size, this.CORNER_SIZE, this.CORNER_SIZE, this.CORNER_SIZE, this.CORNER_SIZE),
            rotVel: 0
        };

        obj.base.setOrigin(0.5).setDepth(GAME_CONSTANTS.DEPTH_TOWER + 1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
        obj.center.setOrigin(0.5).setDepth(GAME_CONSTANTS.DEPTH_TOWER + 2).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
        obj.bright.setOrigin(0.5).setDepth(GAME_CONSTANTS.DEPTH_TOWER + 3).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
        obj.red.setOrigin(0.5).setDepth(GAME_CONSTANTS.DEPTH_TOWER).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);

        return obj;
    }

    /**
     * Internal: get or create from pool.
     */
    _getStrikeObject(size) {
        let obj = this._strikePool.find(o => !o.inUse);
        if (!obj) {
            obj = this._createStrikeObject(size);
            this._strikePool.push(obj);
        }
        obj.inUse = true;
        obj.base.setSize(size, size);
        // center is a plain image, no setSize needed
        obj.bright.setSize(size, size);
        obj.red.setSize(size + 2, size + 2);
        obj.base.setRotation(0);
        obj.center.setRotation(0);
        obj.bright.setRotation(0);
        obj.red.setRotation(0);
        obj.base.setScale(1);
        obj.center.setScale(1);
        obj.bright.setScale(1);
        obj.red.setScale(1);
        obj.rotVel = 0;
        return obj;
    }

    _releaseStrikeObject(obj) {
        obj.inUse = false;
        obj.base.setVisible(false);
        obj.center.setVisible(false);
        obj.bright.setVisible(false);
        obj.red.setVisible(false);
        PhaserScene.tweens.killTweensOf([obj.base, obj.center, obj.bright, obj.red]);
    }

    playStrikeSequence(x, y, size, onDamage, durationOffset = 0) {
        const obj = this._getStrikeObject(size);
        const { base, center, bright, red } = obj;

        base.setPosition(x, y).setVisible(true).setAlpha(0.05).setScale(1.04);
        center.setPosition(x, y).setVisible(true).setAlpha(0.05).setScale(1.04);

        // Stage 1: Initial targeting pulse
        // Alpha 0.2 -> 0.35 over 400ms (Back.easeOut, easeParams: 5)
        PhaserScene.tweens.add({
            targets: [base, center],
            alpha: 0.36,
            duration: 400,
            ease: 'Back.easeOut',
            easeParams: [4],
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: [base, center],
                    alpha: 0.9,
                    duration: 1100 + durationOffset,
                    ease: 'Quad.easeIn',
                    onComplete: () => {
                        // Deal damage
                        onDamage();
                        // Stage 3: Burst animation (similar to cursor)
                        this._playBurstAnimation(obj, x, y, size);
                    }
                });
            }
        });

        // Scale 1.04 -> 1.0 over 700ms (Cubic.easeOut) starting same time
        PhaserScene.tweens.add({
            targets: [base, center],
            scaleX: 1,
            scaleY: 1,
            duration: 700,
            ease: 'Cubic.easeOut'
        });
    }

    _playBurstAnimation(obj, x, y, size) {
        const { base, center, bright, red } = obj;

        const flippedLeft = Math.random() < 0.5;
        const goalRot = flippedLeft ? -0.3 : 0.3;

        // Flash everything (similar to cursor's playFireAnimation)
        bright.setPosition(x, y).setVisible(true).setAlpha(0.9).setScale(1.25).setRotation(goalRot);
        base.setAlpha(1).setScale(1.2).setRotation(goalRot);
        center.setAlpha(1).setScale(1.2).setRotation(goalRot);
        red.setPosition(x, y).setVisible(true).setAlpha(0.45).setScale(1.1).setRotation((Math.random() - 0.5) * 0.09);

        // White tint flash — instant detonation feel
        bright.setTintFill(0xffffff);
        center.setTintFill(0xffffff);
        PhaserScene.time.delayedCall(50, () => {
            if (obj.inUse) {
                bright.setAlpha(0.4).clearTint();
                center.clearTint();
            }
        });

        /** Recoil: briefly shrink the base sprite then spring back. */
        PhaserScene.tweens.add({
            targets: base,
            scaleX: 0.92,
            scaleY: 0.92,
            duration: 40,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: base,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 180,
                    ease: 'Back.easeOut',
                    easeParams: [3],
                });
            }
        });

        // Tween flash back to 0
        PhaserScene.tweens.add({
            delay: 75,
            targets: [bright, red, center],
            alpha: 0,
            duration: 500,
            ease: 'Quart.easeOut',
        });

        // Scale back to original size
        PhaserScene.tweens.add({
            targets: [center, bright],
            scaleX: 1,
            scaleY: 1,
            duration: 240,
            ease: 'Cubic.easeOut',
        });

        PhaserScene.tweens.add({
            targets: [red],
            scaleX: 0.98,
            scaleY: 0.98,
            rotation: 0,
            duration: 240,
            ease: 'Back.easeIn',
            onComplete: () => {
                this._releaseStrikeObject(obj);
            }
        });

        // Camera impact
        if (typeof zoomShake === 'function') zoomShake(1.008);
    }
}

const artilleryAttack = (() => {
    const model = new ArtilleryAttackModel();
    const view = new ArtilleryAttackView();
    const _hitBuffer = [];

    function init() {
        view.init();
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('gamePaused', () => { model.paused = true; });
        messageBus.subscribe('gameResumed', () => { model.paused = false; });
        updateManager.addFunction(_update);
    }

    function unlock() {
        model.unlocked = true;
    }

    function _update(delta) {
        view.update(delta);
        if (!model.unlocked || !model.active || model.paused || !tower.isAlive()) return;

        if (model.updateTimer(delta)) {
            _fire();
        }
    }

    function _fire() {
        const pos1 = _findRandomTarget();
        const size = model.getDamageArea();
        if (typeof audio !== 'undefined') {
            const s = audio.play('artillery_selected', 1.1);
            if (s) s.detune = (Math.random() - 0.5) * 160;
        }

        _createStrikeAt(pos1.x, pos1.y, size, 0);

        if (model.volleyLevel > 0) {
            // Volley adds 2 extra strikes nearby
            const pos2 = _getNearbyTarget(pos1.x, pos1.y);
            PhaserScene.time.delayedCall(100, () => {
                _createStrikeAt(pos2.x, pos2.y, size, 100);
            });

            // For the third strike, attempt to find a position not overlapping Strike 2
            let pos3;
            let tries = 0;
            const maxTries = 15;
            do {
                pos3 = _getNearbyTarget(pos1.x, pos1.y);
                tries++;
                if (tries >= maxTries) break;

                const distToStrike2 = Phaser.Math.Distance.Between(pos3.x, pos3.y, pos2.x, pos2.y);
                const minAllowedDist = (tries <= 5) ? 250 : (tries <= 10 ? 150 : 0);

                if (distToStrike2 >= minAllowedDist) break;
            } while (true);

            PhaserScene.time.delayedCall(200, () => {
                _createStrikeAt(pos3.x, pos3.y, size, 200);
            });
        }
    }

    function _createStrikeAt(x, y, size, durationOffset) {
        view.playStrikeSequence(x, y, size, () => {
            // Damage callback
            if (typeof audio !== 'undefined') {
                const s = audio.play('artillery_explode', 0.9);
                if (s) s.detune = (Math.random() - 0.5) * 160;
            }
            PhaserScene.cameras.main.shake(60, 0.007);
            const halfSize = size / 2;
            const hits = enemyManager.getEnemiesInSquareRange(x, y, halfSize + 5, _hitBuffer);

            for (let i = 0; i < hits.length; i++) {
                const enemy = hits[i];
                let damage = model.BASE_DAMAGE;

                // FIRST STRIKE logic: +10 damage per level to enemies above 80% HP
                if (model.firstStrikeLevel > 0) {
                    const healthPct = enemy.health / enemy.maxHealth;
                    if (healthPct > 0.8) {
                        damage += 10 * model.firstStrikeLevel;
                    }
                }

                enemyManager.damageEnemy(enemy, damage);

                // SHELLSHOCKED logic: 80% slow for 1.25s
                if (model.stunLevel > 0 && typeof enemy.forceSlow === 'function') {
                    enemy.forceSlow(0.15, 1);
                }
            }
        }, durationOffset);
    }

    function _getNearbyTarget(cx, cy) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Phaser.Math.Between(250, 300);

        let tx = cx + Math.cos(angle) * dist;
        let ty = cy + Math.sin(angle) * dist;

        // Keep at least partially on screen
        tx = Phaser.Math.Clamp(tx, 10, GAME_CONSTANTS.WIDTH - 10);
        ty = Phaser.Math.Clamp(ty, 10, GAME_CONSTANTS.HEIGHT - 10);

        return { x: tx, y: ty };
    }

    function _findRandomTarget() {
        const towerPos = tower.getPosition();
        const activeEnemies = enemyManager.getActiveEnemies();

        const minX = model.SCREEN_BORDER_WIDTH;
        const maxX = GAME_CONSTANTS.WIDTH - model.SCREEN_BORDER_WIDTH;
        const minY = model.SCREEN_BORDER_HEIGHT;
        const maxY = GAME_CONSTANTS.HEIGHT - model.SCREEN_BORDER_HEIGHT;

        // Predictive Targeting: Instead of hunting for a random valid spot,
        // we start with a random enemy and check if their future position is valid.
        if (activeEnemies.length > 0) {
            const startIndex = Math.floor(Math.random() * activeEnemies.length);
            for (let i = 0; i < activeEnemies.length; i++) {
                const idx = (startIndex + i) % activeEnemies.length;
                const e = activeEnemies[idx];

                // Strike delay is ~1.5s total (targeting sequence)
                const futureX = e.x + (e.vx * 1.5);
                const futureY = e.y + (e.vy * 1.5);

                const valid = futureX >= minX && futureX <= maxX &&
                    futureY >= minY && futureY <= maxY &&
                    (Math.abs(futureX - towerPos.x) + Math.abs(futureY - towerPos.y) >= model.TOWER_MARGIN);

                if (valid) return { x: futureX, y: futureY };
            }
        }

        // Fallback: If no enemies are valid or screen is empty, pick a safe random spot.
        return {
            x: Phaser.Math.Between(minX, maxX),
            y: Phaser.Math.Between(minY, maxY)
        };
    }

    function _onPhaseChanged(phase) {
        const isCombat = (phase === GAME_CONSTANTS.PHASE_COMBAT);
        if (isCombat && model.unlocked) {
            model.active = true;
            model.fireTimer = 3000;
        } else {
            model.active = false;
        }
    }

    function lock() {
        model.unlocked = false;
        model.active = false;
    }

    // System recalculation (called from upgradeDispatcher)
    function setLevels(levels) {
        model.radiusLevel = levels.radius || 0;
        model.volleyLevel = levels.volley || 0;
        model.firstStrikeLevel = levels.firstStrike || 0;
        model.stunLevel = levels.stun || 0;

        // Auto-update margins based on AOE change
        let marginBase = model.getDamageArea();
        artilleryAttack.setTargetingMargins(marginBase);
    }

    return {
        init, unlock, lock, setLevels, update: (delta) => view.update(delta),
        setTargetingMargins: (n) => model.setTargetingMargins(n)
    };
})();
