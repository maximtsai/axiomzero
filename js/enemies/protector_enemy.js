// js/enemies/protector_enemy.js — Supportive enemy providing a defensive aura (MVC).
//
// Behaviour:
//   • Health is 3x base health, speed is 0.5x base speed.
//   • Cannot rotate. Stops at 210px from tower.
//   • No attack, no self damage.
//   • Aura reduces damage by half to non-protectors within 185px.
//   • Initial spawn: aura starts at 0.75 alpha, 0.25 scale. Tweens to scale 1
//     then fades to 0.22 alpha. Aura becomes active after deploy.
//   • Aura defend trigger turns aura to 0.95 alpha, then fades back.

const PROTECTOR_STATE = {
    RUSHING: 'RUSHING',
    MOVING: 'MOVING',
    IDLE: 'IDLE',
};

const PROTECTOR_RUSH_DURATION = 1.65;

class ProtectorEnemyModel extends EnemyModel {
    constructor() {
        super();
        this.type = 'protector';
        this.baseResourceDrop = 4;
        this.cannotRotate = true;
        this.auraActive = false;
        this.state = PROTECTOR_STATE.MOVING;
        this.rushElapsed = 0;
    }

    getHitFeedbackConfig() {
        return {
            wobbleIntensity: 0.15,
            wobbleDuration: 400,
            flickerAlpha: 0.6,
            flickerDuration: 100
        };
    }
}

class ProtectorEnemyView extends EnemyView {
    constructor() {
        // Aura sprite — created before main sprites so it renders below
        const texKey = Enemy.TEX_KEY;
        // We need a temporary reference since super() must be called first
        super(texKey, 'protector.png', 'protector_enemy_hp.png', GAME_CONSTANTS.DEPTH_ENEMIES);

        // Aura sprite — depth +1 above enemies
        this.auraImg = PhaserScene.add.image(0, 0, texKey, 'protector_aoe.png');
        this.auraImg.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES + 1);
        this.auraImg.setVisible(false);
        this.auraImg.setActive(false);
    }

    activate(x, y, rotation, cannotRotate) {
        super.activate(x, y, rotation, cannotRotate);
        if (this.auraImg) {
            this.auraImg.setVisible(false);
            this.auraImg.setScale(0);
            this.auraImg.setAlpha(0);
            PhaserScene.tweens.killTweensOf(this.auraImg);
        }
    }

    deactivate() {
        super.deactivate();
        if (this.auraImg) {
            PhaserScene.tweens.killTweensOf(this.auraImg);
            this.auraImg.setVisible(false);
            this.auraImg.setActive(false);
        }
    }

    syncAuraPosition(x, y) {
        if (this.auraImg && this.auraImg.visible) {
            this.auraImg.setPosition(x, y);
        }
    }

    deployAura(x, y, onAuraActive) {
        if (!this.auraImg) return;

        this.auraImg.setVisible(true);
        this.auraImg.setActive(true);
        this.auraImg.setAlpha(0.75);
        this.auraImg.setScale(0.25);
        this.auraImg.setPosition(x, y);

        PhaserScene.tweens.add({
            targets: this.auraImg,
            scale: 1,
            duration: 750,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                if (!this.img || !this.img.scene) return;
                this.auraImg.setAlpha(0.95);
                if (onAuraActive) onAuraActive();
                this._playAuraFade(0.22, 750);
            }
        });
    }

    triggerAuraDefend() {
        if (!this.auraImg) return;
        PhaserScene.tweens.killTweensOf(this.auraImg);
        this.auraImg.setAlpha(0.95);
        this._playAuraFade(0.22, 850);
    }

    _playAuraFade(targetAlpha, duration) {
        PhaserScene.tweens.add({
            targets: this.auraImg,
            alpha: targetAlpha,
            duration: duration,
            ease: 'Cubic.easeOut'
        });
    }
}

class ProtectorEnemy extends Enemy {
    constructor() {
        super();
        this.model = new ProtectorEnemyModel();
        this.view = new ProtectorEnemyView();
    }

    activate(x, y, scaleFactor) {
        super.activate(x, y, {
            maxHealth: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 3,
            damage: 0,
            selfDamage: 0,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 0.5,
            size: 26
        });

        this.model.state = PROTECTOR_STATE.RUSHING;
        this.model.rushElapsed = 0;
        this.model.auraActive = false;

        if (this.view.img) this.view.img.setTint(0xffffff);
    }

    deactivate() {
        this.model.auraActive = false;
        super.deactivate();
    }

    update(dt) {
        const m = this.model;
        const v = this.view;

        const tPos = tower.getPosition();
        const dx = tPos.x - m.x;
        const dy = tPos.y - m.y;
        const distToTower = Math.sqrt(dx * dx + dy * dy);

        // Always sync the model state (burn, health, position)
        if (m.state === PROTECTOR_STATE.RUSHING && distToTower > 210 && m.rushElapsed < PROTECTOR_RUSH_DURATION) {
            const t = Math.min(1, m.rushElapsed / PROTECTOR_RUSH_DURATION);
            const mult = 12 - (11 * t);
            super.update(dt * mult);
        } else {
            super.update(dt);
        }

        v.syncAuraPosition(m.x, m.y);

        if (m.state === PROTECTOR_STATE.RUSHING) {
            m.rushElapsed += dt;

            if (distToTower <= 210) {
                m.vx = 0;
                m.vy = 0;
            }

            if (m.rushElapsed >= PROTECTOR_RUSH_DURATION) {
                if (distToTower <= 220) {
                    m.state = PROTECTOR_STATE.IDLE;
                    m.isAttacking = true;
                } else {
                    m.state = PROTECTOR_STATE.MOVING;
                    m.isAttacking = false;
                }
                v.deployAura(m.x, m.y, () => {
                    m.auraActive = true;
                });
            }
        } else if (m.state === PROTECTOR_STATE.MOVING) {
            if (distToTower <= 210) {
                m.state = PROTECTOR_STATE.IDLE;
                m.isAttacking = true;
                m.vx = 0;
                m.vy = 0;
            }
        } else if (m.state === PROTECTOR_STATE.IDLE) {
            m.vx = 0;
            m.vy = 0;
            if (distToTower > 220) {
                m.state = PROTECTOR_STATE.MOVING;
                m.isAttacking = false;
                m.aimAt(tPos.x, tPos.y);
            }
        }
    }

    triggerAuraDefend() {
        if (!this.model.auraActive) return;
        this.view.triggerAuraDefend();
    }
}
