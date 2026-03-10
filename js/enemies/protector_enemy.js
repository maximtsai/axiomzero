// js/enemies/protector_enemy.js — Supportive enemy providing a defensive aura.
//
// Behaviour:
//   • Health is 3x base health.
//   • Speed is 0.5x base speed.
//   • Size is 1.5x basic enemy (18px).
//   • Cannot rotate.
//   • Stops at 210px from tower.
//   • No attack, no self damage.
//   • Aura reduces damage by half to non-protectors within 185px.
//   • Initial spawn: aura starts at 0.75 alpha, 0.25 scale. Tweens to scale 1 over 0.75s (cubic.easeOut).
//     Then alpha to 0.95, and fades to 0.22 over 0.75s (cubic.easeOut). Aura becomes active.
//   • Aura effect trigger turns aura to 0.95 alpha, then fades to 0.22 over 0.85s (cubic.easeOut).

const PROTECTOR_STATE = {
    RUSHING: 'RUSHING',
    MOVING: 'MOVING',
    IDLE: 'IDLE', // stopped at 210px
};

const PROTECTOR_RUSH_DURATION = 1.65;

class ProtectorEnemy extends Enemy {
    constructor() {
        super();
        this.type = 'protector';
        this.baseResourceDrop = 4;

        // Aura sprite - depth +1 above enemies
        this.auraImg = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'protector_aoe.png');
        this.auraImg.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES + 1);
        this.auraImg.setVisible(false);
        this.auraImg.setActive(false);

        this.img = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'protector.png');
        this.img.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES);
        this.img.setVisible(false);
        this.img.setActive(false);

        // UI: Health sprite overlay
        this.hpImg = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'protector_enemy_hp.png');
        this.hpImg.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES);
        this.hpImg.setVisible(false);
        this.hpImg.setActive(false);

        this.cannotRotate = true;
        this.auraActive = false;
        this.state = PROTECTOR_STATE.MOVING;
        this.rushElapsed = 0;
    }

    activate(x, y, scaleFactor) {
        super.activate(x, y, {
            maxHealth: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 3,
            damage: 0,
            selfDamage: 0,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 0.5,
            size: 26
        });

        this.state = PROTECTOR_STATE.RUSHING;
        this.rushElapsed = 0;
        this.auraActive = false;

        if (this.auraImg) {
            this.auraImg.setVisible(false);
            this.auraImg.setScale(0);
            this.auraImg.setAlpha(0);
            PhaserScene.tweens.killTweensOf(this.auraImg);
        }

        if (this.img) this.img.setTint(0xffffff);
    }

    deactivate() {
        super.deactivate();
        this.auraActive = false;
        if (this.auraImg) {
            PhaserScene.tweens.killTweensOf(this.auraImg);
            this.auraImg.setVisible(false);
            this.auraImg.setActive(false);
        }
    }

    update(dt) {
        if (this.auraImg && this.auraImg.visible) {
            this.auraImg.setPosition(this.x, this.y);
        }

        const tPos = tower.getPosition();
        const dx = tPos.x - this.x;
        const dy = tPos.y - this.y;
        const distToTower = Math.sqrt(dx * dx + dy * dy);

        if (this.state === PROTECTOR_STATE.RUSHING) {
            this.rushElapsed += dt;
            const t = Math.min(1, this.rushElapsed / PROTECTOR_RUSH_DURATION);

            // Start at 6x basic (12x self), end at 1x self.
            const mult = 12 - (11 * t);

            if (distToTower <= 210) {
                // Stop moving but wait for rush to finish for aura
                this.vx = 0;
                this.vy = 0;
            } else {
                super.update(dt * mult);
            }

            if (this.rushElapsed >= PROTECTOR_RUSH_DURATION) {
                this.state = (distToTower <= 220) ? PROTECTOR_STATE.IDLE : PROTECTOR_STATE.MOVING;
                this._deployAura();
            }
        } else if (this.state === PROTECTOR_STATE.MOVING) {
            if (distToTower <= 210) {
                this.state = PROTECTOR_STATE.IDLE;
                this.vx = 0;
                this.vy = 0;
            } else {
                super.update(dt);
            }
        } else if (this.state === PROTECTOR_STATE.IDLE) {
            if (distToTower > 220) {
                this.state = PROTECTOR_STATE.MOVING;
                this.aimAt(tPos.x, tPos.y);
            }
        }
    }

    _deployAura() {
        if (!this.auraImg) return;

        this.auraImg.setVisible(true);
        this.auraImg.setActive(true);
        this.auraImg.setAlpha(0.75);
        this.auraImg.setScale(0.25);
        this.auraImg.setPosition(this.x, this.y);

        PhaserScene.tweens.add({
            targets: this.auraImg,
            scale: 1,
            duration: 750,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                if (!this.img || !this.img.scene) return;
                this.auraImg.setAlpha(0.95);
                this.auraActive = true;
                this._playAuraFade(0.22, 750);
            }
        });
    }

    triggerAuraDefend() {
        if (!this.auraActive || !this.auraImg) return;

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

    getHitFeedbackConfig() {
        return {
            wobbleIntensity: 0.15,
            wobbleDuration: 400,
            flickerAlpha: 0.6,
            flickerDuration: 100
        };
    }
}
