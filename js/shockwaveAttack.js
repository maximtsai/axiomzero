// shockwaveAttack.js — Periodic AoE shockwave pulse centered on the tower.
// Expands a shockwave ring outward from the tower, damaging all nearby enemies.
// Uses shockwave.png from the 'player' atlas. Activated/deactivated by duo-box swap.

class ShockwaveAttackModel {
    constructor() {
        this.FIRE_INTERVAL = 3000;  // ms between pulses
        this.BASE_DAMAGE = 5;
        this.BASE_RADIUS = 140;     // px — damage radius

        this.active = false;
        this.unlocked = false;
        this.paused = false;
        this.fireTimer = 0;
        this.damage = this.BASE_DAMAGE;
        this.radius = this.BASE_RADIUS;
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

class ShockwaveAttackView {
    constructor() {
        this.EXPAND_DURATION = 350;  // ms — ring expansion time
        this.MAX_SCALE = 0.6;       // final scale of shockwave.png (400×400 base)

        this.sprite = null;
    }

    init() {
        this.sprite = PhaserScene.add.image(0, 0, 'player', 'shockwave.png');
        this.sprite.setOrigin(0.5, 0.5);
        this.sprite.setDepth(GAME_CONSTANTS.DEPTH_TOWER - 1); // Below tower
        this.sprite.setScrollFactor(0);
        this.sprite.setScale(0.05);
        this.sprite.setAlpha(0);
        this.sprite.setVisible(false);
    }

    playPulse(x, y) {
        if (!this.sprite) return;

        this.sprite.setPosition(x, y);
        this.sprite.setScale(0.05);
        this.sprite.setAlpha(1.5);
        this.sprite.setVisible(true);
        this.sprite.setRotation(Math.random() * Math.PI * 2);

        PhaserScene.tweens.add({
            targets: this.sprite,
            scaleX: this.MAX_SCALE,
            scaleY: this.MAX_SCALE,
            alpha: 0,
            duration: this.EXPAND_DURATION,
            ease: 'Quad.easeIn',
            onComplete: () => {
                this.sprite.setVisible(false);
            }
        });
    }

    setVisible(vis) {
        if (this.sprite && !vis) {
            this.sprite.setVisible(false);
            this.sprite.setAlpha(0);
        }
    }
}

// Controller IIFE
const shockwaveAttack = (() => {
    const model = new ShockwaveAttackModel();
    const view = new ShockwaveAttackView();

    // Reusable array for enemy queries
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
        // If we're already in combat, activate immediately
        if (gameStateMachine.getPhase() === GAME_CONSTANTS.PHASE_COMBAT) {
            model.active = true;
            model.resetTimer();
        }
    }

    function lock() {
        model.unlocked = false;
        model.active = false;
        view.setVisible(false);
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

        view.playPulse(pos.x, pos.y);

        // Damage all enemies in range (using square approximation)
        const halfSize = model.radius;
        const hits = enemyManager.getEnemiesInSquareRange(pos.x, pos.y, halfSize, _hitBuffer);
        for (let i = 0; i < hits.length; i++) {
            // Additional circle check for more accurate radius
            const e = hits[i];
            const dx = e.x - pos.x;
            const dy = e.y - pos.y;
            if (dx * dx + dy * dy <= model.radius * model.radius) {
                enemyManager.damageEnemy(e, model.damage);
            }
        }

        // Subtle camera shake
        zoomShake(1.003);
    }

    function _onPhaseChanged(phase) {
        const isCombat = phase === GAME_CONSTANTS.PHASE_COMBAT;

        if (isCombat && model.unlocked) {
            model.active = true;
            model.resetTimer();
        } else {
            model.active = false;
            view.setVisible(false);
        }
    }

    return { init, unlock, lock };
})();
