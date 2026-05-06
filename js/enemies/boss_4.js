// js/enemies/boss_4.js — Boss 4 (EXECUTE).
// A relentless, high-precision entity that focuses on single-target neutralization.

const BOSS_4_STATE = {
    ARRIVING: 'arriving',
    AIMING: 'aiming',
    CHARGING: 'charging',
    STUCK: 'stuck',
    RETRACTING: 'retracting',
    PREPARING: 'preparing'
};

class Boss4Model extends BossModel {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.bossId = 'boss4';
        this.type = 'boss4';
        this.size = 140;
        this.initialSpeedMult = 6.5;
        this.rampDuration = 2.0;
        
        this.behaviorState = BOSS_4_STATE.ARRIVING;
        this.stateTimer = 0;
        this.chargeProgress = 0;
    }

    activate(x, y, config = {}) {
        super.activate(x, y, config);
        this.behaviorState = BOSS_4_STATE.ARRIVING;
        this.stateTimer = 0;
        this.chargeProgress = 0;
    }
}

class Boss4View extends EnemyView {
    constructor() {
        const baseDepth = GAME_CONSTANTS.DEPTH_ENEMIES - 1;
        // Using boss_1.png as a placeholder if boss_4.png is not yet available in the atlas
        super('bosses', 'boss_1.png', 'boss_hp.png', baseDepth);
        
        // Placeholder for core glow (could use a pixel or existing frame)
        this.coreGlow = PhaserScene.add.image(0, 0, 'bosses', 'boss_3_charge.png');
        this.coreGlow.setDepth(baseDepth + 1);
        this.coreGlow.setVisible(false);
        this.coreGlow.setAlpha(0);
        this.coreGlow.setTint(0xff0000);
    }

    update(dt, model) {
        super.update(dt, model);
        
        if (model.behaviorState === BOSS_4_STATE.CHARGING) {
            this.coreGlow.setVisible(true);
            this.coreGlow.setAlpha(model.chargeProgress * 0.8);
            this.img.setTint(helper.interpolateColor(0xffffff, 0xff3333, model.chargeProgress));
        } else {
            this.img.clearTint();
            this.coreGlow.setVisible(false);
        }
    }

    syncPosition(x, y) {
        super.syncPosition(x, y);
        if (this.coreGlow) this.coreGlow.setPosition(x, y);
    }

    deactivate() {
        super.deactivate();
        if (this.coreGlow) this.coreGlow.setVisible(false);
    }
}

class Boss4 extends Boss {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.model = new Boss4Model(levelScalingModifier);
        this.view = new Boss4View();
    }

    activate(x, y, scale = 1.0, config = {}) {
        const bossHealth = 700;

        super.activate(x, y, {
            maxHealth: bossHealth,
            damage: 15,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 1.15,
            initialSpeedMult: this.model.initialSpeedMult,
            rampDuration: this.model.rampDuration,
            size: this.model.size,
            ...config
        });

        PhaserScene.time.delayedCall(1000, () => {
            messageBus.publish('BossAnnounceText', { msg1: t('ui', 'boss_prefix'), msg2: t('ui', 'boss_4_name') });
        });
    }

    update(dt) {
        if (!this.model.alive) return;

        // State Machine
        switch (this.model.behaviorState) {
            case BOSS_4_STATE.ARRIVING:
                // Logic for ARRIVING -> AIMING transition to be added later
                break;

            case BOSS_4_STATE.AIMING:
                // Logic for AIMING -> CHARGING transition to be added later
                break;

            case BOSS_4_STATE.CHARGING:
                // Logic for CHARGING -> STUCK transition to be added later
                break;

            case BOSS_4_STATE.STUCK:
                // Logic for STUCK -> RETRACTING transition to be added later
                break;

            case BOSS_4_STATE.RETRACTING:
                // Logic for RETRACTING -> PREPARING transition to be added later
                break;

            case BOSS_4_STATE.PREPARING:
                // Logic for PREPARING -> CHARGING transition to be added later
                break;
        }

        super.update(dt);
    }
}
