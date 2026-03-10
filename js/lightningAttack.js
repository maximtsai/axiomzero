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
        // Nothing to pre-create — bolts are drawn on demand
    }

    drawBolt(fromX, fromY, toX, toY) {
        const gfx = PhaserScene.add.graphics();
        gfx.setDepth(150); // Below tower (200) but above enemies (100)
        gfx.setScrollFactor(0);

        const dx = toX - fromX;
        const dy = toY - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) { gfx.destroy(); return; }

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

        // Draw glow (wider, lower alpha)
        gfx.lineStyle(this.BOLT_LINE_WIDTH * 3, 0x4488ff, 0.35);
        gfx.beginPath();
        gfx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            gfx.lineTo(points[i].x, points[i].y);
        }
        gfx.strokePath();

        // Draw core bolt (bright white-cyan)
        gfx.lineStyle(this.BOLT_LINE_WIDTH, 0xccffff, 1.0);
        gfx.beginPath();
        gfx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            gfx.lineTo(points[i].x, points[i].y);
        }
        gfx.strokePath();

        // Fade out and destroy
        gfx.setAlpha(1);
        PhaserScene.tweens.add({
            targets: gfx,
            alpha: 0,
            duration: this.BOLT_FADE_DURATION,
            ease: 'Quad.easeIn',
            onComplete: () => {
                gfx.destroy();
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
                if (dist < bestDist) {
                    bestDist = dist;
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
