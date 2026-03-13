// shockwaveAttack.js — Periodic AoE shockwave pulse centered on the tower.
// Expands a shockwave ring outward from the tower, damaging all nearby enemies.
// Uses shockwave.png from the 'player' atlas. Activated/deactivated by duo-box swap.

class ShockwaveAttackModel {
    constructor() {
        this.FIRE_INTERVAL = 3000;  // ms between pulses
        this.BASE_DAMAGE = 6;
        this.BASE_RADIUS = 130;     // px — damage radius

        this.active = false;
        this.unlocked = false;
        this.paused = false;
        this.fireTimer = 0;
        this.radius = this.BASE_RADIUS;
        this.damage = this.BASE_DAMAGE;
        this.resonanceDmgPerHit = 0;
        this.seismicCrushMultiplier = 0; // 0.5 per level
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
        this.EXPAND_DURATION = 400; // ms — expansion time
        this.FADE_DURATION = 1000;  // ms — ring fade time
        this.MAX_SCALE = 0.7;       // scale of shockwave.png (400×400 base) to match 160px radius

        this.sprite = null;
    }

    init() {
        this.sprite = PhaserScene.add.image(0, 0, 'player', 'shockwave.png');
        this.sprite.setOrigin(0.5, 0.5);
        this.sprite.setDepth(150); // Below tower (200) but above enemies (100)
        this.sprite.setScrollFactor(0);
        this.sprite.setScale(0.05);
        this.sprite.setAlpha(0);
        this.sprite.setVisible(false);
    }

    playPulse(x, y, scaleMultiplier = 1.0) {
        if (!this.sprite) return;

        this.sprite.setPosition(x, y);
        const targetScale = this.MAX_SCALE * scaleMultiplier;
        this.sprite.setScale(targetScale * 0.7);
        this.sprite.setAlpha(1.0);
        this.sprite.setVisible(true);
        this.sprite.setRotation(Math.random() * Math.PI * 2);

        // Expansion tween
        PhaserScene.tweens.add({
            targets: this.sprite,
            scaleX: targetScale,
            scaleY: targetScale,
            duration: this.EXPAND_DURATION,
            ease: 'Quart.easeOut'
        });

        // Fade out tween
        PhaserScene.tweens.add({
            targets: this.sprite,
            alpha: 0,
            duration: this.FADE_DURATION,
            ease: 'Power1.easeOut',
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

    function setAmplifierLevel(level) {
        if (level > 0) {
            model.radius = model.BASE_RADIUS * 1.4;
        } else {
            model.radius = model.BASE_RADIUS;
        }
    }

    function setResonanceLevel(level) {
        model.resonanceDmgPerHit = level;
    }

    function setSeismicCrushLevel(level) {
        model.seismicCrushMultiplier = level * 0.5;
    }

    function setDamage(amount) {
        model.damage = amount;
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

        view.playPulse(pos.x, pos.y, model.radius / model.BASE_RADIUS);

        // Damage all enemies in range (using square approximation)
        const halfSize = model.radius;
        const hits = enemyManager.getEnemiesInSquareRange(pos.x, pos.y, halfSize, _hitBuffer);

        // Circle check and count valid hits
        let validHits = [];
        for (let i = 0; i < hits.length; i++) {
            const e = hits[i];
            const dx = e.x - pos.x;
            const dy = e.y - pos.y;
            const distSq = dx * dx + dy * dy;

            // Inclusion check: shockwave edge touches enemy edge
            const checkR = model.radius + (e.size || 12);
            if (distSq <= checkR * checkR) {
                validHits.push(e);
            }
        }

        const totalDamage = model.damage + (model.resonanceDmgPerHit * validHits.length);

        for (let i = 0; i < validHits.length; i++) {
            const e = validHits[i];
            let actualDamage = totalDamage;

            // Seismic Crush checks if enemy is below 50% HP
            if (model.seismicCrushMultiplier > 0 && e.health < e.maxHealth * 0.5) {
                actualDamage *= (1 + model.seismicCrushMultiplier);
            }

            enemyManager.damageEnemy(e, actualDamage);
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

    return { init, unlock, lock, setAmplifierLevel, setResonanceLevel, setSeismicCrushLevel, setDamage };
})();
