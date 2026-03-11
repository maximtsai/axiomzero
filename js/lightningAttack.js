// lightningAttack.js — Chain lightning attack from the tower.
// Fires a jagged lightning bolt toward the nearest enemy, then chains
// to additional nearby enemies. Activated/deactivated by duo-box swap.

class LightningAttackModel {
    constructor() {
        this.FIRE_INTERVAL = 2500;  // ms between strikes
        this.BASE_DAMAGE = 6;
        this.BASE_CHAIN_COUNT = 2;  // total enemies hit (1 primary + 1 chain)
        this.CHAIN_RANGE = 115;     // px — max distance for chain to jump

        this.active = false;  // true when combat phase AND unlocked
        this.unlocked = false;
        this.paused = false;
        this.fireTimer = 0;
        this.damage = this.BASE_DAMAGE;
        this.chainCount = this.BASE_CHAIN_COUNT;
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
                img.setScrollFactor(0);
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
                img.setScrollFactor(0);
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

    drawBolt(fromX, fromY, toX, toY) {
        const dx = toX - fromX;
        const dy = toY - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return;

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

        const segments = [];

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            const segDx = p2.x - p1.x;
            const segDy = p2.y - p1.y;
            const segDist = Math.sqrt(segDx * segDx + segDy * segDy);
            const segAngle = Math.atan2(segDy, segDx);

            // Draw glow (wider, lower alpha)
            const glow = this.glowPool.get();
            glow.setPosition(p1.x, p1.y);
            glow.setRotation(segAngle);
            glow.setDisplaySize(segDist, this.BOLT_LINE_WIDTH * 5);
            glow.setAlpha(0.35);
            glow.setTint(0x4488ff);
            glow.setVisible(true);
            glow.setActive(true);

            // Draw core bolt (bright white-cyan)
            const core = this.corePool.get();
            core.setPosition(p1.x, p1.y);
            core.setRotation(segAngle);
            core.setDisplaySize(segDist, this.BOLT_LINE_WIDTH);
            core.setTint(0xccffff);
            core.setAlpha(1.0);
            core.setVisible(true);
            core.setActive(true);

            segments.push(glow, core);
        }

        // Flicker effect: 1 repeat (total 2 cycles)
        PhaserScene.tweens.add({
            targets: segments,
            alpha: { from: 0.05, to: 1.0 },
            duration: 40,
            yoyo: true,
            repeat: 1,
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

    function init() {
        view.init();
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('gamePaused', () => { model.paused = true; });
        messageBus.subscribe('gameResumed', () => { model.paused = false; });
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

    function _update(delta) {
        if (model.paused || !model.active) return;

        if (model.updateTimer(delta)) {
            _fire();
        }
    }

    function _fire() {
        const pos = tower.getPosition();
        if (!pos) return;

        // Find nearest enemy to the tower
        const first = enemyManager.getNearestEnemy(pos.x, pos.y, 9999);
        if (!first) return;

        const hitEnemies = [first];
        view.drawBolt(pos.x, pos.y, first.x, first.y);
        enemyManager.damageEnemy(first, model.damage);

        // Chain to additional enemies
        let lastHit = first;
        for (let c = 1; c < model.chainCount; c++) {
            let bestDist = model.CHAIN_RANGE;
            let bestEnemy = null;

            const enemies = enemyManager.getActiveEnemies();
            for (let i = 0; i < enemies.length; i++) {
                const e = enemies[i];
                if (!e.alive) continue;
                // Skip already hit enemies
                let alreadyHit = false;
                for (let j = 0; j < hitEnemies.length; j++) {
                    if (hitEnemies[j] === e) { alreadyHit = true; break; }
                }
                if (alreadyHit) continue;

                const dx = e.x - lastHit.x;
                const dy = e.y - lastHit.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const effectiveDist = dist - (e.size || 0) - (lastHit.size || 0);

                if (effectiveDist < bestDist) {
                    bestDist = effectiveDist;
                    bestEnemy = e;
                }
            }

            if (!bestEnemy) break;

            view.drawBolt(lastHit.x, lastHit.y, bestEnemy.x, bestEnemy.y);
            enemyManager.damageEnemy(bestEnemy, model.damage);
            hitEnemies.push(bestEnemy);
            lastHit = bestEnemy;
        }

        // Micro camera shake
        zoomShake(1.003);
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

    return { init, unlock, lock, setChainCount, setDamage };
})();
