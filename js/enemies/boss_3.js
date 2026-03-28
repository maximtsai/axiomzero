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

        this.initialSpeedMult = 18.0;
        this.rampDuration = 2.8;
        this.siphonPulse = 0; // Remains for view sync, but will be purely visual
        this.hasPostUpdate = true;
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
            if (dist < 260) {
                this.state = BOSS_3_PIECE_STATES.IDLE;
                this.vx = 0;
                this.vy = 0;
            }
        } else if (this.state === BOSS_3_PIECE_STATES.IDLE) {
            this.vx = 0;
            this.vy = 0;
        }

        return burnTick;
    }

    // Refactor 2: Post-update hook for HP sharing
    postUpdate(dt) {
        this.shareTimer -= dt;
        if (this.shareTimer <= 0) {
            this.shareTimer = 1.0;
            // The manager will orchestrate the actual calculate/apply calls
            // since it has access to the full enemy list for cross-piece sync.
        }

        if (this.siphonPulse > 0) {
            this.siphonPulse -= dt * 2.5;
            if (this.siphonPulse < 0) this.siphonPulse = 0;
        }
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

let _sharedAttackSprite = null;
let _sharedAttackActive = false;
let _sharedAttackCooldown = 0;
let _sharedAttackBuildUp = 0;

// Cleanup static assets on phase change/game reset
if (typeof messageBus !== 'undefined') {
    messageBus.subscribe('phaseChanged', (phase) => {
        if (phase !== GAME_CONSTANTS.PHASE_COMBAT) {
            _sharedAttackActive = false;
            _sharedAttackCooldown = 0;
            _sharedAttackBuildUp = 0;
            if (_sharedAttackSprite) {
                _sharedAttackSprite.setVisible(false);
                PhaserScene.tweens.killTweensOf(_sharedAttackSprite);
            }
        }
    });
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

        // Charge sprite
        this.chargeSprite = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'boss_3_charge.png');
        this.chargeSprite.setDepth(this.img.depth + 1);
        this.chargeSprite.setScale(1);
        this.chargeSprite.setAlpha(0);
        this.chargeSprite.setVisible(false);
    }

    activate(x, y, rotation, cannotRotate) {
        super.activate(x, y, rotation, cannotRotate);
        this.lineGraphics.setVisible(true);
        this.pulse.setVisible(true);
        this.pulse.setPosition(x, y);
        this._startPulseEffect();

        this.chargeSprite.setVisible(true);
        this.chargeSprite.setPosition(x, y);
        this.chargeSprite.setRotation(rotation);
        this.chargeSprite.setAlpha(0);
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
        if (this.chargeSprite) this.chargeSprite.setPosition(x, y);
    }

    deactivate() {
        super.deactivate();
        if (this.lineGraphics) this.lineGraphics.clear().setVisible(false);
        if (this.pulse) {
            this.pulse.setVisible(false);
            PhaserScene.tweens.killTweensOf(this.pulse);
        }
        if (this.chargeSprite) {
            this.chargeSprite.setVisible(false);
            PhaserScene.tweens.killTweensOf(this.chargeSprite);
        }
        if (this.pulseTimer) {
            this.pulseTimer.remove();
            this.pulseTimer = null;
        }
    }

    playChargeAnimation() {
        if (!this.chargeSprite) return;
        this.chargeSprite.setAlpha(0);

        // 0.0 -> 0.1 -> 0.2 -> 1.5 sequence handled by Boss3 controller collectively
    }

    setChargeAlpha(alpha) {
        if (this.chargeSprite) this.chargeSprite.setAlpha(alpha);
    }
}

class Boss3 extends Boss {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.model = new Boss3PieceModel(levelScalingModifier);
        this.view = new Boss3PieceView();
        this._isMaster = false;
    }

    activate(x, y, scale = 1.0, config = {}) {
        this.model.config = config; // Persistent config for shard indexing
        this._isMaster = false;     // Reset master status on pool reuse

        super.activate(x, y, {
            maxHealth: 250,
            damage: 0,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 0.6,
            initialSpeedMult: this.model.initialSpeedMult,
            rampDuration: this.model.rampDuration,
            size: 50,
            ...config
        });

        // Face tower
        const angle = Math.atan2(GAME_CONSTANTS.halfHeight - y, GAME_CONSTANTS.halfWidth - x);
        this.setRotation(angle);
    }

    update(dt) {
        super.update(dt);

        // Core Attack orchestration
        if (!_sharedAttackActive && _sharedAttackCooldown <= 0) {
            // Trigger if any unit (this one) is IDLE (ready)
            if (this.model.state === BOSS_3_PIECE_STATES.IDLE) {
                this.startGroupAttack();
            }
        }

        if (_sharedAttackCooldown > 0) {
            // Only update shared timers once per frame (triggered by the master shard)
            // If the master shard dies, its update won't run - handled in onDeath logic
            if (this._isMaster) {
                _sharedAttackCooldown -= dt;
            }
        }

        // Shared view update handled in Enemy loop, but we proxy the alpha here
        if (_sharedAttackActive) {
            if (this._isMaster) {
                _sharedAttackBuildUp += dt;
                _sharedAttackCooldown = 0; // Explicit reset while charging
            }

            const b = _sharedAttackBuildUp;
            let alpha = 0;

            if (b < 0.1) {
                alpha = (b / 0.1) * 0.5;
            } else if (b < 0.2) {
                alpha = 0.5 - ((b - 0.1) / 0.1) * 0.4;
            } else if (b < 2.5) {
                const progress = (b - 0.2) / 2.3;
                alpha = 0.1 + (Math.pow(progress, 2) * 0.9);
            } else {
                alpha = 1.0;
            }

            this.view.setChargeAlpha(alpha);

            if (_sharedAttackBuildUp >= 2.5 && _sharedAttackActive) {
                // Impact Phase! Handled by one shard to avoid multiple hits
                this.finishGroupAttack();
            }
        } else {
            this.view.setChargeAlpha(0);
        }
    }

    startGroupAttack() {
        if (_sharedAttackActive) return;
        _sharedAttackActive = true;
        _sharedAttackBuildUp = 0;

        const tx = GAME_CONSTANTS.halfWidth;
        const ty = GAME_CONSTANTS.halfHeight;

        if (!_sharedAttackSprite) {
            _sharedAttackSprite = PhaserScene.add.image(tx, ty, Enemy.TEX_KEY, 'boss3_attack.png');
            _sharedAttackSprite.setDepth(205); // Above tower (200)
        }

        _sharedAttackSprite.setPosition(tx, ty);
        _sharedAttackSprite.setScale(1.03);
        _sharedAttackSprite.setAlpha(0);
        _sharedAttackSprite.setVisible(true);

        _sharedAttackSprite.currAnim = PhaserScene.tweens.add({
            targets: _sharedAttackSprite,
            alpha: 0.9,
            duration: 2500,
            ease: 'Quad.easeIn'
        });
    }

    finishGroupAttack() {
        _sharedAttackActive = false;
        _sharedAttackCooldown = 3.0;

        if (_sharedAttackSprite) {
            if (_sharedAttackSprite.currAnim) {
                _sharedAttackSprite.currAnim.stop();
            }
            _sharedAttackSprite.setFrame('boss3_attack_thick.png');
            _sharedAttackSprite.setScale(1.045);
            PhaserScene.tweens.add({
                targets: _sharedAttackSprite,
                scaleX: 0.06,
                scaleY: 0.06,
                alpha: 1,
                duration: 450,
                ease: 'Quad.easeIn',
                onComplete: () => {
                    _sharedAttackSprite.setFrame('boss3_attack.png');
                    _sharedAttackSprite.setVisible(false);
                    if (typeof tower !== 'undefined' && tower.isAlive()) {
                        tower.takeDamage(10);
                        if (typeof cameraManager !== 'undefined') {
                            cameraManager.shake(300, 0.015);
                        }
                    }
                }
            });
        }
    }

    // Refactor 1: Staged Death logic
    onDeath(isFinal = true) {
        if (!isFinal) {
            // Master reassignment if the controller shard dies
            if (this._isMaster) {
                const shards = enemyManager.getEnemiesByType('boss3');
                const nextMaster = shards.find(s => s !== this && s.model.alive);
                if (nextMaster) nextMaster._isMaster = true;
            }

            // Shard shattered animation
            if (typeof customEmitters !== 'undefined') {
                const depth = (this.view && this.view.img) ? this.view.img.depth : GAME_CONSTANTS.DEPTH_ENEMIES;
                customEmitters.playExplosionPulse(this.model.x, this.model.y, depth, 0.75, 'explosion_pulse');
            }
            if (typeof audio !== 'undefined') audio.play('explosion_death', 0.65);
        } else {
            // Core Legion death - cleanup group effects
            _sharedAttackActive = false;
            _sharedAttackBuildUp = 0;
            if (_sharedAttackSprite) {
                _sharedAttackSprite.setVisible(false);
                PhaserScene.tweens.killTweensOf(_sharedAttackSprite);
            }

            super.onDeath(true);
            if (typeof audio !== 'undefined') audio.play('on_death_boss', 0.9);
        }
    }

    setNeighbors(n1, n2) {
        this.model.neighbors = [n1, n2];
    }

    /**
     * Refactor 3: Static Spawn Layout for the 8-piece octagon
     */
    static getSpawnLayout(sx, sy, angle, distance) {
        const layout = [];
        const count = 6;
        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;

        // Offset by 30 degrees (PI/6) to avoid top/bottom units and create 3 left/3 right clusters
        const angleOffset = Math.PI / 6;

        for (let i = 0; i < count; i++) {
            const shardAngle = (angle + angleOffset) + (i * (Math.PI * 2 / count));
            const px = cx + Math.cos(shardAngle) * distance;
            const py = cy + Math.sin(shardAngle) * distance;
            layout.push({
                x: px,
                y: py,
                angle: shardAngle,
                config: {
                    legionIndex: i
                }
            });
        }
        return layout;
    }

    /**
     * Refactor 4: Post-spawn logic to link neighbors in a ring
     */
    static postSpawn(spawnedPieces) {
        const count = spawnedPieces.length;
        if (count > 0) {
            spawnedPieces[0]._isMaster = true; // First spawned shard is the global timer manager
        }

        for (let i = 0; i < count; i++) {
            const prev = spawnedPieces[(i + count - 1) % count];
            const next = spawnedPieces[(i + 1) % count];
            spawnedPieces[i].setNeighbors(next, prev);
        }
    }
}
