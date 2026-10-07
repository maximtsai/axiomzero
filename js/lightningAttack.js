// lightningAttack.js — Chain lightning attack from the tower.
// Fires a jagged lightning bolt toward the nearest enemy, then chains
// to additional nearby enemies. Activated/deactivated by duo-box swap.

class LightningAttackModel {
    constructor() {
        this.FIRE_INTERVAL = 3000;  // ms between strikes
        this.BASE_DAMAGE = 12;
        this.BASE_CHAIN_COUNT = 2;  // total enemies hit (1 primary + 1 chain)
        this.CHAIN_RANGE = 130;     // px — max distance for chain to jump

        this.active = false;  // true when combat phase AND unlocked
        this.unlocked = false;
        this.paused = false;
        this.damage = this.BASE_DAMAGE;
        this.chainCount = this.BASE_CHAIN_COUNT;
        this.staticChargeBonus = 0; // 4 per level
        this.fireTimer = 0;
    }

    setFireInterval(ms) {
        this.FIRE_INTERVAL = ms;
    }

    resetTimer() {
        this.fireTimer = 0;
    }

    updateTimer(delta) {
        this.fireTimer += delta;
        if (this.fireTimer >= this.FIRE_INTERVAL) {
            this.fireTimer -= this.FIRE_INTERVAL;
            return true;
        }
        return false;
    }
}

class LightningAttackView {
    constructor() {
        this.BOLT_SEGMENTS = 7;       // segments per bolt
        this.BOLT_JITTER = 10;        // max perpendicular offset per joint
        this.BOLT_FADE_DURATION = 200; // ms bolt visible
        this.BOLT_LINE_WIDTH = 2.5;

        this.bolts = [];  // active bolt graphics objects
    }

    init() {
        this.glowPool = new ObjectPool(
            () => {
                const img = PhaserScene.add.image(0, 0, 'player', 'lightning_glow.png');
                img.setDepth(150);
                img.setOrigin(0, 0.5);
                img.setVisible(false);
                img.setActive(false);
                return img;
            },
            (img) => {
                img.setVisible(false);
                img.setActive(false);
            },
            50
        );

        this.corePool = new ObjectPool(
            () => {
                const img = PhaserScene.add.image(0, 0, 'player', 'lightning_core.png');
                img.setDepth(151);
                img.setOrigin(0, 0.5);
                img.setVisible(false);
                img.setActive(false);
                return img;
            },
            (img) => {
                img.setVisible(false);
                img.setActive(false);
            },
            50
        );
    }

    _generatePoints(fromX, fromY, toX, toY) {
        const dx = toX - fromX;
        const dy = toY - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return [];

        // Perpendicular direction for jitter
        const perpX = -dy / dist;
        const perpY = dx / dist;

        // Generate jagged bolt points
        const points = [{ x: fromX, y: fromY }];
        for (let i = 1; i < this.BOLT_SEGMENTS; i++) {
            const t = i / this.BOLT_SEGMENTS;
            const baseX = fromX + dx * t;
            const baseY = fromY + dy * t;
            const jitter = (Math.random() - 0.5) * 2 * this.BOLT_JITTER;
            points.push({
                x: baseX + perpX * jitter,
                y: baseY + perpY * jitter,
            });
        }
        points.push({ x: toX, y: toY });
        return points;
    }

    _updateSegments(segments, points) {
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            const segDx = p2.x - p1.x;
            const segDy = p2.y - p1.y;
            const segDist = Math.sqrt(segDx * segDx + segDy * segDy);
            const segAngle = Math.atan2(segDy, segDx);

            const glow = segments[i * 2];
            const core = segments[i * 2 + 1];

            glow.setPosition(p1.x, p1.y).setRotation(segAngle).setDisplaySize(segDist, this.BOLT_LINE_WIDTH * 5);
            core.setPosition(p1.x, p1.y).setRotation(segAngle).setDisplaySize(segDist, this.BOLT_LINE_WIDTH);
        }
    }

    drawBolt(fromX, fromY, toX, toY) {
        const points = this._generatePoints(fromX, fromY, toX, toY);
        if (points.length === 0) return;

        const segments = [];
        for (let i = 0; i < points.length - 1; i++) {
            const glow = this.glowPool.get();
            glow.setAlpha(1).setVisible(true).setActive(true);
            helper.setTint(glow, 0x4488ff);

            const core = this.corePool.get();
            core.setAlpha(1.0).setVisible(true).setActive(true);
            helper.setTint(core, 0xccffff);

            segments.push(glow, core);
        }

        // Initial positioning
        this._updateSegments(segments, points);

        // Flicker effect: 1 repeat (total 2 cycles)
        PhaserScene.tweens.add({
            targets: segments,
            alpha: { from: 0.05, to: 1.0 },
            duration: 40,
            yoyo: true,
            repeat: 1,
            onRepeat: () => {
                // Redraw points for the second flicker
                const newPoints = this._generatePoints(fromX, fromY, toX, toY);
                this._updateSegments(segments, newPoints);
            },
            onComplete: () => {
                // Fade out and return to pool
                PhaserScene.tweens.add({
                    targets: segments,
                    alpha: 0,
                    duration: this.BOLT_FADE_DURATION,
                    ease: 'Quad.easeIn',
                    onComplete: () => {
                        segments.forEach(s => {
                            if (s.frame.name === 'lightning_glow.png') this.glowPool.release(s);
                            else this.corePool.release(s);
                        });
                    }
                });
            }
        });
    }
}

// Controller IIFE
const lightningAttack = (() => {
    const model = new LightningAttackModel();
    const view = new LightningAttackView();
    const _queryResults = []; // Reusable array to eliminate GC during chain lookups

    function init() {
        view.init();
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('gamePaused', () => { model.paused = true; });
        messageBus.subscribe('gameResumed', () => { model.paused = false; });
        messageBus.subscribe('testingDefensesStarted', () => { model.resetTimer(); });
        messageBus.subscribe('testingDefensesEnded', () => { model.resetTimer(); });
        updateManager.addFunction(_update);
    }

    function unlock() {
        model.unlocked = true;
        // If we're already in combat, activate immediately
        if (gameStateMachine.getPhase() === GAME_CONSTANTS.PHASE_COMBAT) {
            model.active = true;
            model.resetTimer();
        }
    }

    function lock() {
        model.unlocked = false;
        model.active = false;
    }

    function setChainCount(count) {
        model.chainCount = count;
    }

    function setDamage(dmg) {
        model.damage = dmg;
    }

    function setStaticChargeLevel(level) {
        model.staticChargeBonus = level * 4;
    }

    function _update(delta) {
        const isTesting = typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses;
        if (!model.unlocked || model.paused || (!model.active && !isTesting) || !tower.isAlive()) return;

        if (model.updateTimer(delta) && !_fire()) {
            // No target: stay charged so the first enemy to appear is struck at once
            model.fireTimer = model.FIRE_INTERVAL;
        }
    }

    /** True if the enemy is inside the visible play area (lightning doesn't strike off-screen). */
    function _isOnScreen(e) {
        const m = e.model;
        return m.x >= 0 && m.x <= GAME_CONSTANTS.WIDTH && m.y >= 0 && m.y <= GAME_CONSTANTS.HEIGHT;
    }

    /** @returns {boolean} True if a bolt was fired. */
    function _fire() {
        const pos = tower.getPosition();
        if (!pos) return false;

        // Find nearest enemy to the tower; nothing on screen → hold the charge
        const first = enemyManager.getNearestEnemy(pos.x, pos.y, GAME_CONSTANTS.WIDTH);
        if (!first || !_isOnScreen(first)) return false;

        // Hits are recorded with the enemy's spawn serial: a pooled enemy that died and
        // respawned within the chain delay is a different target, not the one we hit.
        const hitEnemies = [{ e: first, serial: first.model.spawnSerial }];
        view.drawBolt(pos.x, pos.y, first.model.x, first.model.y);

        let actualDamage = model.damage;
        if (model.staticChargeBonus > 0 && first.model.health >= first.model.maxHealth * 0.8) {
            actualDamage += model.staticChargeBonus;
        }
        enemyManager.damageEnemy(first, actualDamage, 'lightning');

        // Micro camera shake at t=0
        zoomShake(1.003);

        // Play initial shock sound
        const soundName = `shock${Phaser.Math.Between(1, 3)}`;
        const sound = audio.play(soundName, 0.6);
        if (sound) {
            sound.detune = Phaser.Math.Between(-150, 80);
        }

        // Start dynamic chain sequence (position and serial captured now, not when the step runs)
        if (model.chainCount > 1) {
            const fx = first.model.x, fy = first.model.y, serial = first.model.spawnSerial;
            PhaserScene.time.delayedCall(100, () => {
                _chainStep(first, serial, fx, fy, hitEnemies, 1);
            });
        }
        return true;
    }

    function _chainStep(lastHit, lastSerial, fromX, fromY, hitEnemies, currentChain) {
        if (!tower.isAlive() || model.paused) return;

        // Track the enemy if it's still the same live enemy, otherwise jump from where it was hit
        const sameLife = lastHit && lastHit.model && lastHit.model.alive && lastHit.model.spawnSerial === lastSerial;
        const originX = sameLife ? lastHit.model.x : fromX;
        const originY = sameLife ? lastHit.model.y : fromY;
        const lastHitSize = (lastHit && lastHit.model) ? (lastHit.model.size || 15) : 15;

        let bestDist = model.CHAIN_RANGE;
        let bestEnemy = null;

        // Fast lookup in range around the resolved origin at the current time
        _queryResults.length = 0;
        enemyManager.getEnemiesInSquareRange(originX, originY, model.CHAIN_RANGE, _queryResults);

        for (let i = 0; i < _queryResults.length; i++) {
            const e = _queryResults[i];
            if (!e.model.alive) continue;
            // Skip already hit enemies to ensure we don't double-chain
            let alreadyHit = false;
            for (let j = 0; j < hitEnemies.length; j++) {
                if (hitEnemies[j].e === e && hitEnemies[j].serial === e.model.spawnSerial) { alreadyHit = true; break; }
            }
            if (alreadyHit) continue;

            const dx = e.model.x - originX;
            const dy = e.model.y - originY;
            const d2 = dx * dx + dy * dy;

            // Pre-check with squared distance to avoid sqrt in 99% of cases
            const maxDR = bestDist + (e.model.size || 0) + lastHitSize;
            if (d2 < maxDR * maxDR) {
                const dist = Math.sqrt(d2);
                const effectiveDist = dist - (e.model.size || 0) - lastHitSize;

                if (effectiveDist < bestDist) {
                    bestDist = effectiveDist;
                    bestEnemy = e;
                }
            }
        }

        if (!bestEnemy) return;

        view.drawBolt(originX, originY, bestEnemy.model.x, bestEnemy.model.y);

        let chainDamage = model.damage;
        if (model.staticChargeBonus > 0 && bestEnemy.model.health >= bestEnemy.model.maxHealth * 0.8) {
            chainDamage += model.staticChargeBonus;
        }
        enemyManager.damageEnemy(bestEnemy, chainDamage, 'lightning');

        // Play chain shock sound matching the visual bounce only on the second chain (third enemy hit)
        if (currentChain === 2) {
            const soundName = `shock${Phaser.Math.Between(1, 3)}`;
            const sound = audio.play(soundName, 0.4);
            if (sound) {
                sound.detune = Phaser.Math.Between(-50, 180);
            }
        }

        const serial = bestEnemy.model.spawnSerial;
        hitEnemies.push({ e: bestEnemy, serial });

        // Schedule next chain step dynamically
        if (currentChain + 1 < model.chainCount) {
            const bx = bestEnemy.model.x, by = bestEnemy.model.y;
            PhaserScene.time.delayedCall(85, () => {
                _chainStep(bestEnemy, serial, bx, by, hitEnemies, currentChain + 1);
            });
        }
    }

    function _onPhaseChanged(phase) {
        const isCombat = phase === GAME_CONSTANTS.PHASE_COMBAT;

        if (isCombat && model.unlocked) {
            model.active = true;
            model.resetTimer();
        } else {
            model.active = false;
        }
    }

    function getBaseDamage() { return model.BASE_DAMAGE; }
    function getBaseChainCount() { return model.BASE_CHAIN_COUNT; }

    return { init, unlock, lock, setChainCount, setDamage, setStaticChargeLevel, getBaseDamage, getBaseChainCount, setFireInterval: (ms) => model.setFireInterval(ms) };
})();
