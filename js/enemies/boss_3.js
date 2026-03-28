// js/enemies/boss_3.js — Boss 3 (Legion) - An 8-piece fragmented boss.
// Each piece is a "Data Shard" that shares HP with its neighbors.

const BOSS_3_PIECE_STATES = {
    TRAVEL: 'travel',
    IDLE: 'idle'
};

class Boss3PieceModel extends BossModel {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.size = 50;
        this.bossId = 'boss3';
        this.type = 'boss3';
        this.state = BOSS_3_PIECE_STATES.TRAVEL;

        this.neighbors = []; // Up to 2 adjacent Boss3 instances
        this.shareTimer = 1.0;
        this.pendingHPChange = 0;

        this.initialSpeedMult = 4.0;
        this.rampDuration = 1.2;
        this.siphonPulse = 0;
    }

    activate(x, y, config = {}) {
        super.activate(x, y, config);
        this.state = BOSS_3_PIECE_STATES.TRAVEL;
        this.shareTimer = 1.0;
        this.pendingHPChange = 0;
        this.siphonPulse = 0;
        this.neighbors = config.neighbors || [];
    }

    update(dt) {
        const burnTick = super.update(dt);
        if (!this.alive) return burnTick;

        // shareHP calculation logic
        this.shareTimer -= dt;
        if (this.shareTimer <= 0) {
            this.shareTimer = 1.0;
            // The actual siphoning is triggered by the enemyManager to ensure synchronization
            // but the individual piece could also trigger it if it's the "master" of its connections.
            // However, the user asked for a "1 by 1" logic followed by "apply all at once".
        }

        const centerX = GAME_CONSTANTS.halfWidth;
        const centerY = GAME_CONSTANTS.halfHeight;
        const dx = this.x - centerX;
        const dy = this.y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (this.state === BOSS_3_PIECE_STATES.TRAVEL) {
            if (dist < 120) {
                this.state = BOSS_3_PIECE_STATES.IDLE;
                this.vx = 0;
                this.vy = 0;
            }
        } else if (this.state === BOSS_3_PIECE_STATES.IDLE) {
            this.vx = 0;
            this.vy = 0;
        }

        if (this.siphonPulse > 0) {
            this.siphonPulse -= dt * 2.0;
            if (this.siphonPulse < 0) this.siphonPulse = 0;
        }

        return burnTick;
    }

    calculateSiphon() {
        if (!this.alive || this.health <= 0) return;

        for (const neighbor of this.neighbors) {
            if (neighbor && neighbor.model && neighbor.model.alive) {
                const myHP = this.health;
                const otherHP = neighbor.model.health;

                // Health flows from high HP to low HP
                if (myHP > otherHP) {
                    const diff = myHP - otherHP;
                    const giveAmount = diff / 4;

                    // Only give if neighbor is still alive/viable
                    if (otherHP > 0) {
                        this.pendingHPChange -= giveAmount;
                        neighbor.model.pendingHPChange += giveAmount;
                    }
                }
            }
        }
    }

    applySiphon() {
        if (!this.alive) {
            this.pendingHPChange = 0;
            return;
        }
        if (Math.abs(this.pendingHPChange) > 0.01) {
            this.siphonPulse = 1.0;
        }
        this.health += this.pendingHPChange;
        if (this.health > this.maxHealth) this.health = this.maxHealth;
        // Don't die from siphoning alone (though the math shouldn't allow it to go below lower HP)
        if (this.health < 0.1) this.health = 0.1;
        this.pendingHPChange = 0;
    }
}

class Boss3PieceView extends EnemyView {
    constructor() {
        super(Enemy.TEX_KEY, 'boss_3.png', 'boss_3_hp.png', GAME_CONSTANTS.DEPTH_ENEMIES - 2);

        this.lineGraphics = PhaserScene.add.graphics();
        this.lineGraphics.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES - 3);

        // Pulse effect (pink themed for Legion)
        this.pulse = PhaserScene.add.nineslice(0, 0, Enemy.TEX_KEY, 'pink_pulse.png', 120, 120, 65, 65, 65, 65);
        this.pulse.setTint(0xff66cc);
        this.pulse.setDepth(this.img.depth - 1);
        this.pulse.setVisible(false);
        this.pulse.setAlpha(0);
    }

    activate(x, y, rotation, cannotRotate) {
        super.activate(x, y, rotation, cannotRotate);
        this.lineGraphics.setVisible(true);
        this.pulse.setVisible(true);
        this.pulse.setPosition(x, y);
        this._startPulseEffect();
    }

    _startPulseEffect() {
        const playPulse = () => {
            if (!this.pulse || !this.pulse.scene) return;
            this.pulse.width = 100;
            this.pulse.height = 100;
            this.pulse.setAlpha(0.6);
            PhaserScene.tweens.add({
                targets: this.pulse,
                width: 220,
                height: 220,
                alpha: 0,
                duration: 1800,
                ease: 'Sine.easeOut'
            });
        };
        playPulse();
        this.pulseTimer = PhaserScene.time.addEvent({
            delay: 2400,
            callback: playPulse,
            loop: true
        });
    }

    update(dt, model) {
        super.update(dt, model);

        // Draw connection to the FIRST neighbor (to avoid double drawing in a ring)
        this.lineGraphics.clear();
        if (model && model.alive && model.neighbors[0] && model.neighbors[0].model && model.neighbors[0].model.alive) {
            const n = model.neighbors[0].model;

            // Pulse logic: base alpha 0.15, max alpha 0.8. Base thickness 1.5, max 4.
            const p = model.siphonPulse || 0;
            const alpha = 0.15 + (p * 0.65);
            const thickness = 1.5 + (p * 2.5);

            this.lineGraphics.lineStyle(thickness, 0xff00ff, alpha);
            this.lineGraphics.moveTo(model.x, model.y);
            this.lineGraphics.lineTo(n.x, n.y);
            this.lineGraphics.strokePath();

            // Optional: add a tiny glow bit at the ends
        }
    }

    syncPosition(x, y) {
        super.syncPosition(x, y);
        if (this.pulse) this.pulse.setPosition(x, y);
    }

    deactivate() {
        super.deactivate();
        if (this.lineGraphics) this.lineGraphics.clear().setVisible(false);
        if (this.pulse) this.pulse.setVisible(false);
        if (this.pulseTimer) this.pulseTimer.remove();
    }
}

class Boss3 extends Boss {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.model = new Boss3PieceModel(levelScalingModifier);
        this.view = new Boss3PieceView();
        this._isMaster = false; // Used if we want one piece to trigger the group siphon
    }

    activate(x, y, scale = 1.0, config = {}) {
        super.activate(x, y, {
            maxHealth: 250,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * 1.5,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 2.2,
            initialSpeedMult: 8.0,
            rampDuration: 1.4,
            size: 50,
            ...config
        });

        // Face tower
        const angle = Math.atan2(GAME_CONSTANTS.halfHeight - y, GAME_CONSTANTS.halfWidth - x);
        this.setRotation(angle);
    }

    update(dt) {
        super.update(dt);

        if (this._isMaster) {
            // Master logic could go here, but enemyManager will handle cross-piece synchronization
        }
    }

    setNeighbors(n1, n2) {
        this.model.neighbors = [n1, n2];
    }
}
