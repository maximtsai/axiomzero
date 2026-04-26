// tower.js — Player Tower entity (Refactored to MVC)
// Owns the tower sprite, glow, breathe animation, health, regen, EXP, and auto-attack.
//
// Two-stage visual lifecycle:
//   spawn()   — creates a sparkle placeholder at screen center (called on AWAKEN node purchase)
//   awaken()  — destroys sparkle, creates real tower sprite + glow, enables auto-attack

class TowerModel {
    constructor() {
        this.health = 0;
        this.maxHealth = 0;
        this.damage = 0;
        this.attackRange = 0;
        this.healthRegen = 0;
        this.attackCooldown = 0;
        this.attackTimer = 0;
        this.armor = 0;
        this.exp = 0;
        this.bugReportAccumulator = 0;

        this.alive = false;
        this.active = false;       // true only during COMBAT_PHASE
        this.isInvincible = false;       // true briefly after a boss is defeated
        this.awakened = false; // true after awaken() is called
        this.paused = false;
        this.hasWarnedThisWave = false;
        this.backupUsed = false;
        this.iterativeGrowthUsed = false;
    }

    recalcStats() {
        const ups = gameState.upgrades || {};
        const integrityLv = ups.integrity || 0;
        const intensityLv = ups.intensity || 0;
        const regenLv = ups.regen || 0;
        const coverageLv = ups.coverage || 0;
        const focus2Lv = ups.focus_range_2 || 0;
        const focus3Lv = ups.focus_range_3 || 0;
        const armorLv = ups.armor || 0;
        const baseHpLv = ups.base_hp_boost || 0;
        const clockSpeedLv = ups.clock_speed || 0;
        const synergyLv = ups.core_synergy || 0;
        const anchorHp = (ups.physical_anchor || 0) * 40;
        this.emergencyOverclockLv = ups.emergency_overclock || 0;

        const systemRedundancyLv = ups.system_redundancy_new || 0;
        const permanentHp = gameState.permanentHpBonus || 0;
        this.maxHealth = GAME_CONSTANTS.TOWER_BASE_HEALTH + 5 * integrityLv + 20 * systemRedundancyLv + anchorHp + permanentHp;
        const shellDamage = (ups.shell_access || 0) * 4 + baseHpLv * 4;

        const autoDefLv = ups.automated_defense || 0;
        if (autoDefLv > 0) {
            this.damage = 5 + 2 * intensityLv + 2 * synergyLv + shellDamage;
        } else {
            this.damage = 0;
        }

        if (autoDefLv > 0) {
            // node grants base 230 range
            this.attackRange = 230 * (1 + 0.2 * coverageLv + 0.2 * focus2Lv + 0.2 * focus3Lv);
        } else {
            this.attackRange = 0;
        }
        const lvlCfg = getCurrentLevelConfig();
        // const baseDecay = lvlCfg.healthDecay || 0;
        this.healthRegen = 0.4 * regenLv; // baseDecay commented out per request
        this.armor = armorLv * 2; // 2 flat damage reduction per level
        this.attackCooldown = GAME_CONSTANTS.TOWER_ATTACK_COOLDOWN * (1 - 0.05 * clockSpeedLv);

        // Root Access damage reduction
        this.damageReceivedMultiplier = (ups.root_access || 0) >= 1 ? 0.9 : 1.0;
    }

    reset() {
        this.recalcStats();
        this.health = this.maxHealth;
        this.alive = true;
        this.attackTimer = 0;
        // EXP no longer resets between waves, but we capture the starting point for summary screens
        this.isInvincible = false;
        this.hasWarnedThisWave = false;
        this.bugReportAccumulator = 0;
        this.backupUsed = false;
        messageBus.publish(GAME_CONSTANTS.EVENTS.HEALTH_CHANGED, this.health, this.maxHealth);
        messageBus.publish(GAME_CONSTANTS.EVENTS.EXP_CHANGED, this.exp, GAME_CONSTANTS.EXP_TO_INSIGHT);
    }

    takeDamage(amount) {
        if (!this.alive || this.isInvincible) return false;

        let reducedAmount = Math.max(0, amount - this.armor);

        // Apply percentage reduction from Root Access
        reducedAmount *= this.damageReceivedMultiplier;

        this.health -= reducedAmount;
        if (this.health <= 0) {
            this.health = 0;

            // ── Backup Server logic ──
            const ups = gameState.upgrades || {};
            if (ups.backup_server && !this.backupUsed) {
                this.resurrect();
                messageBus.publish(GAME_CONSTANTS.EVENTS.TOWER_BACKUP_TRIGGERED);
                return true; // Survived via backup
            }

            this.die();
            return false; // Did not survive
        }
        messageBus.publish(GAME_CONSTANTS.EVENTS.HEALTH_CHANGED, this.health, this.maxHealth);
        return true; // Survived and took damage
    }

    heal(amount) {
        if (!this.alive) return 0;
        const oldHealth = this.health;
        this.health = Math.min(this.health + amount, this.maxHealth);
        const actualHealed = this.health - oldHealth;
        if (actualHealed > 0) {
            messageBus.publish(GAME_CONSTANTS.EVENTS.HEALTH_CHANGED, this.health, this.maxHealth);
        }
        return actualHealed;
    }

    die() {
        this.alive = false;
        this.active = false;
        this.isInvincible = false;
        messageBus.publish(GAME_CONSTANTS.EVENTS.HEALTH_CHANGED, this.health, this.maxHealth);
        messageBus.publish(GAME_CONSTANTS.EVENTS.TOWER_DIED);
    }

    resurrect() {
        this.alive = true;
        this.active = true;
        const ups = gameState.upgrades || {};
        if (ups.restore_point > 0) {
            this.health = this.maxHealth * 0.4;
        } else {
            this.health = 1;
        }
        this.backupUsed = true;
        this.isInvincible = false; // controller will set the timed one
        messageBus.publish(GAME_CONSTANTS.EVENTS.HEALTH_CHANGED, this.health, this.maxHealth);

        // Apply repulsion wave to nearby enemies
        const pushbackRange = 350;
        const pushbackAmount = 75;
        const nearby = enemyManager.getEnemiesInRange(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, pushbackRange);
        for (let i = 0; i < nearby.length; i++) {
            if (nearby[i].model) {
                nearby[i].model.pushback = pushbackAmount;
            }
        }
    }
}

class TowerView {
    constructor() {
        this.sparkleSprite = null;
        this.sparkleTween = null;

        this.sprite = null;
        this.glowSprite = null;
        this.artilleryCallSprite = null;
        this.rangeSprite = null;  // Range indicator circle below tower
        this.breatheTween = null;
        this.deathShockwave = null;
        this.warnShockwave = null;
        this.artilleryCallTween = null;
    }

    spawn(cx, cy) {
        if (this.sparkleSprite) return; // already spawned

        this.sparkleSprite = PhaserScene.add.image(cx, cy, 'player', 'sparkle.png');
        this.sparkleSprite.setDepth(GAME_CONSTANTS.DEPTH_TOWER);
        this.sparkleSprite.setAlpha(0.8);
        this.sparkleSprite.setTint(GAME_CONSTANTS.COLOR_FRIENDLY);
        this.sparkleSprite.setBlendMode(Phaser.BlendModes.ADD);

        this.sparkleTween = PhaserScene.tweens.add({
            targets: this.sparkleSprite,
            alpha: { from: 0.4, to: 1.0 },
            scale: { from: 0.8, to: 1.2 },
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
    }

    awaken(cx, cy, attackRange) {
        // Destroy sparkle placeholder
        if (this.sparkleTween) { this.sparkleTween.stop(); this.sparkleTween = null; }
        if (this.sparkleSprite) { this.sparkleSprite.destroy(); this.sparkleSprite = null; }

        // Clean up any existing range sprite (safety check)
        if (this.rangeSprite) { this.rangeSprite.destroy(); this.rangeSprite = null; }

        // Glow layer — additive blend, subtle breathe animation
        this.glowSprite = PhaserScene.add.image(cx, cy, 'player', 'tower1_glow.png');
        this.glowSprite.setDepth(GAME_CONSTANTS.DEPTH_TOWER);
        this.glowSprite.setScale(1.0);
        this.glowSprite.setAlpha(1);
        this.glowSprite.setBlendMode(Phaser.BlendModes.ADD);

        // Pre-create death shockwave (temp depth 0 for visibility)
        this.deathShockwave = PhaserScene.add.image(cx, cy, 'player', 'deathwave.png');
        this.deathShockwave.setDepth(-2).setAlpha(0);

        this.warnShockwave = PhaserScene.add.image(cx, cy, 'player', 'warnwave.png');
        this.warnShockwave.setDepth(-2).setAlpha(0);

        // Main tower sprite
        this.sprite = PhaserScene.add.sprite(cx, cy, 'player', 'tower1.png');
        this.sprite.setDepth(GAME_CONSTANTS.DEPTH_TOWER);
        this.sprite.setAlpha(1);
        this.sprite.clearTint();

        this.artilleryCallSprite = PhaserScene.add.image(cx, cy, 'player', 'tower_artillery_call.png');
        this.artilleryCallSprite.setDepth(GAME_CONSTANTS.DEPTH_TOWER + 1);
        this.artilleryCallSprite.setAlpha(0);
        this.artilleryCallSprite.setBlendMode(Phaser.BlendModes.ADD);

        // Range indicator — positioned below tower, scaled to represent attack range
        // Plays awakening animation via updateRangeSprite()
        const rangeScale = attackRange / 195;  // 195 = base range for 400x400 sprite
        this.rangeSprite = PhaserScene.add.image(cx, cy, 'player', 'range.png');
        this.rangeSprite.setDepth(1);  // Rendered behind almost everything
        this.rangeSprite.setBlendMode(Phaser.BlendModes.ADD);
        if (rangeScale > 0.001) {
            this.rangeSprite.setAlpha(0.45 / 3);
            this.rangeSprite.setScale(rangeScale * 0.2);
        } else {
            this.rangeSprite.setAlpha(0);
            this.rangeSprite.setScale(0);
        }
        this.updateRangeSprite(rangeScale);

        // Breathe / pulse tween on glow
        this.breatheTween = PhaserScene.tweens.add({
            targets: this.glowSprite,
            scale: { from: 1.0, to: 1.1 },
            duration: 2200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
    }

    refreshRangeSprite(attackRange, pos, isIntense = false) {
        const rangeScale = attackRange / 202;
        if (!this.rangeSprite) {
            this.rangeSprite = PhaserScene.add.image(pos.x, pos.y, 'player', 'range.png');
            this.rangeSprite.setDepth(1);
            this.rangeSprite.setAlpha(0);
            this.rangeSprite.setScale(rangeScale * 0.2);
        }
        this.updateRangeSprite(rangeScale, isIntense);
    }

    updateRangeSprite(newScale, isIntense = false) {
        if (!this.rangeSprite) return;

        // Kill existing tweens on rangeSprite to prevent conflicts
        PhaserScene.tweens.killTweensOf(this.rangeSprite);

        if (newScale <= 0) {
            this.rangeSprite.setScale(0);
            this.rangeSprite.setAlpha(0);
            this.rangeSprite.setVisible(false);
            return;
        }

        this.rangeSprite.setVisible(true);

        // Alpha animation: dim → full → bright → back to dim
        PhaserScene.tweens.add({
            targets: this.rangeSprite,
            alpha: 0.45,
            duration: 450,
            ease: 'Cubic.easeOut',
            completeDelay: 100,
        });

        const hasRangeShifted = Math.abs(newScale - this.rangeSprite.scaleX) > 0.001;
        const overshoot = isIntense ? 1.14 : 1.1;
        const shakeMag = (isIntense) ? 0.003 : (hasRangeShifted ? 0.002 : 0);

        // Scale animation
        this.rangeSprite.currAnim = PhaserScene.tweens.add({
            targets: this.rangeSprite,
            scaleX: newScale * overshoot,
            scaleY: newScale * overshoot,
            duration: 550,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.rangeSprite.currAnim = PhaserScene.tweens.add({
                    targets: this.rangeSprite,
                    scaleX: newScale,
                    scaleY: newScale,
                    duration: 350,
                    ease: 'Cubic.easeIn',
                    onComplete: () => {
                        // add a tiny brief zoom in here
                        if (shakeMag > 0) PhaserScene.cameras.main.shake(80, shakeMag);
                        this.rangeSprite.setAlpha(1);
                        this.rangeSprite.currAnim = PhaserScene.tweens.add({
                            targets: this.rangeSprite,
                            alpha: 0.40,
                            duration: 1400,
                            ease: 'Quart.easeOut',
                            onComplete: () => {
                                this.rangeSprite.currAnim = null;
                            }
                        });
                    }
                });
            }
        });
    }

    playHitFlash() {
        if (this.sprite) {
            this.sprite.setTintFill(0xffffff);
            PhaserScene.time.delayedCall(80, () => {
                if (this.sprite && this.sprite.scene) {
                    this.sprite.clearTint();
                }
            });
        }
    }

    playHitEffect(x, y) {
        if (!this._hitAnimPool) return;
        const fx = this._hitAnimPool.get();
        fx.setPosition(x, y);
        fx.setActive(true);
        fx.setVisible(true);
        fx.setRotation(Math.random() * Math.PI * 2);
        fx.play('enemy_strike');
    }

    playUpgradePhaseAnimation(attackRange) {
        if (!this.rangeSprite) return;

        if (attackRange <= 0) {
            this.rangeSprite.setVisible(false);
            this.rangeSprite.setAlpha(0);
            return;
        }

        if (this.rangeSprite.currAnim) {
            this.rangeSprite.currAnim.stop();
        }
        this.rangeSprite.setVisible(true);
        this.rangeSprite.setAlpha(0);
        const rangeScale = attackRange / 202;
        this.rangeSprite.setScale(rangeScale * 1.05);
        this.rangeSprite.currAnim = PhaserScene.tweens.add({
            targets: this.rangeSprite,
            alpha: 0.40,
            duration: 0.5,
            ease: 'Cubic.easeOut',
            scaleX: rangeScale,
            scaleY: rangeScale,
            onComplete: () => {
                this.rangeSprite.currAnim = null;
            }
        });
    }

    /** Briefly recoil away from the target then spring back. */
    playRecoil(targetX, targetY) {
        if (!this.sprite || !this.sprite.scene) return;

        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;
        const dx = targetX - cx;
        const dy = targetY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const recoilDist = 5; // Pixels to move backward

        const rx = cx - (dx / dist) * recoilDist;
        const ry = cy - (dy / dist) * recoilDist;
        // Kill existing recoil tweens
        PhaserScene.tweens.killTweensOf([this.sprite, this.glowSprite], ['x', 'y', 'scaleX', 'scaleY']);

        // 1. Positional recoil (faster)
        PhaserScene.tweens.add({
            targets: [this.sprite, this.glowSprite],
            x: rx,
            y: ry,
            duration: 155,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: [this.sprite, this.glowSprite],
                    x: cx,
                    y: cy,
                    duration: 270,
                    ease: 'Back.easeOut',
                    easeParams: [3]
                });
            }
        });

        // 2. Scale recoil (slightly longer total duration)
        PhaserScene.tweens.add({
            targets: [this.sprite, this.glowSprite],
            scaleX: 0.9,
            scaleY: 0.9,
            duration: 170,
            ease: 'Quad.easeOut',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: [this.sprite, this.glowSprite],
                    scaleX: 1.0,
                    scaleY: 1.0,
                    duration: 300,
                    ease: 'Back.easeOut',
                    easeParams: [1.75]
                });
            }
        });
    }

    cleanupRangeSprite() {
        if (this.rangeSprite) { this.rangeSprite.destroy(); this.rangeSprite = null; }
    }

    getPosition() {
        return { x: GAME_CONSTANTS.halfWidth, y: GAME_CONSTANTS.halfHeight };
    }

    setVisible(vis) {
        if (this.sprite) this.sprite.setVisible(vis);
        if (this.glowSprite) this.glowSprite.setVisible(vis);
        if (this.rangeSprite) this.rangeSprite.setVisible(vis);
        if (this.sparkleSprite) this.sparkleSprite.setVisible(vis);
        if (this.artilleryCallSprite) this.artilleryCallSprite.setVisible(vis);
    }

    setPosition(x, y) {
        if (this.sprite) this.sprite.setPosition(x, y);
        if (this.glowSprite) this.glowSprite.setPosition(x, y);
        if (this.rangeSprite) this.rangeSprite.setPosition(x, y);  // 80px below tower
        if (this.sparkleSprite) this.sparkleSprite.setPosition(x, y);
        if (this.artilleryCallSprite) this.artilleryCallSprite.setPosition(x, y);
    }

    playArtilleryCallAnimation(fast = false) {
        if (!this.artilleryCallSprite) return;

        // Cancel previous instance
        if (this.artilleryCallTween) {
            this.artilleryCallTween.stop();
            this.artilleryCallTween = null;
        }

        const fadeDuration = (fast === true) ? 350 : 750;
        const endAlpha = (fast === true) ? 0.7 : 1;

        this.artilleryCallSprite.setAlpha(0);

        this.artilleryCallTween = PhaserScene.tweens.add({
            targets: this.artilleryCallSprite,
            alpha: endAlpha,
            duration: 10,
            ease: 'Linear',
            onComplete: () => {
                this.artilleryCallTween = PhaserScene.tweens.add({
                    targets: this.artilleryCallSprite,
                    alpha: 0,
                    duration: fadeDuration,
                    ease: 'Cubic.easeOut',
                    onComplete: () => {
                        this.artilleryCallTween = null;
                    }
                });
            }
        });
    }

    shake(duration, onComplete) {
        const targets = [];
        if (this.sprite) targets.push(this.sprite);
        if (this.glowSprite) targets.push(this.glowSprite);
        if (this.rangeSprite) targets.push(this.rangeSprite);
        if (this.sparkleSprite) targets.push(this.sparkleSprite);
        if (targets.length === 0) { if (onComplete) onComplete(); return; }

        // Elevate above death overlay
        if (this.sprite) this.sprite.setDepth(GAME_CONSTANTS.DEPTH_DEATH_TOWER);
        if (this.glowSprite) this.glowSprite.setDepth(GAME_CONSTANTS.DEPTH_DEATH_TOWER);
        if (this.rangeSprite) this.rangeSprite.setDepth(GAME_CONSTANTS.DEPTH_DEATH_TOWER);
        if (this.sparkleSprite) this.sparkleSprite.setDepth(GAME_CONSTANTS.DEPTH_DEATH_TOWER);

        const origX = targets[0].x;
        const stepDuration = duration / 5;

        // 5 sequential oscillations with decreasing amplitude (damping effect)
        const amplitudes = [12, 8, 4, 2, 1];
        amplitudes.forEach((amp, index) => {
            const isLastOscillation = index === amplitudes.length - 1;
            PhaserScene.tweens.add({
                targets,
                x: { from: origX - amp, to: origX + amp },
                duration: stepDuration,
                yoyo: true,
                delay: index * stepDuration,
                ease: 'Linear',
                onComplete: isLastOscillation ? () => {
                    // Snap back and restore normal depths
                    for (let i = 0; i < targets.length; i++) { targets[i].x = origX; }
                    if (this.sprite) this.sprite.setDepth(GAME_CONSTANTS.DEPTH_TOWER);
                    if (this.glowSprite) this.glowSprite.setDepth(GAME_CONSTANTS.DEPTH_TOWER);
                    if (this.rangeSprite) this.rangeSprite.setDepth(1);
                    if (this.sparkleSprite) this.sparkleSprite.setDepth(GAME_CONSTANTS.DEPTH_TOWER);
                    if (onComplete) onComplete();
                } : undefined,
            });
        });
    }

    playDeathShockwave(duration = 750) {
        if (!this.deathShockwave) {
            // Safety: create it if it doesn't exist for some reason
            this.deathShockwave = PhaserScene.add.image(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, 'player', 'deathwave.png');
            this.deathShockwave.setDepth(-2).setScrollFactor(0).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
        }
        // Reset and trigger
        this.deathShockwave.setVisible(true).setAlpha(0.9).setScale(0.15);

        // Environment grid pulse via glitch system
        glitchFX.triggerDeathGrid(duration);

        PhaserScene.tweens.add({
            targets: this.deathShockwave,
            scale: 8,
            duration: duration,
            ease: 'Cubic.easeOut'
        });

        PhaserScene.tweens.add({
            targets: this.deathShockwave,
            alpha: 0,
            duration: duration,
            ease: 'Cubic.easeOut',
        });
    }

    playWarnShockwave(duration = 750, startAlpha = 1.0, endScale = 3.0) {
        if (!this.warnShockwave) {
            this.warnShockwave = PhaserScene.add.image(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, 'player', 'warnwave.png');
            this.warnShockwave.setDepth(-2).setAlpha(1).setBlendMode(Phaser.BlendModes.ADD);
        }
        // Reset and trigger
        this.warnShockwave.setVisible(true).setAlpha(startAlpha).setScale(0.25);

        PhaserScene.tweens.add({
            targets: this.warnShockwave,
            scale: endScale,
            duration: duration,
            ease: 'Cubic.easeOut'
        });

        PhaserScene.tweens.add({
            targets: this.warnShockwave,
            alpha: 0,
            duration: duration,
            ease: 'Cubic.easeOut',
        });
    }

    playDeathVisuals() {
        if (!this.sprite || !this.sprite.scene) return;
        console.log("playDeathVisuals");

        // 0.25 seconds after death sequence begins
        PhaserScene.time.delayedCall(250, () => {
            if (!this.sprite || !this.sprite.scene) return;

            // Set to broken sprite
            this.sprite.setFrame('tower1_broke.png');
            this.sprite.setScale(0.85);

            // Impact tween to normal scale
            PhaserScene.tweens.add({
                targets: this.sprite,
                scaleX: 1,
                scaleY: 1,
                duration: 100,
                ease: 'Cubic.easeOut'
            });
        });
    }

    playResetVisuals() {
        if (!this.sprite || !this.sprite.scene) return;

        // Sequence: 1.3 @ 500ms → 0.9 @ 150ms → Swap → 1.0 @ 250ms
        PhaserScene.tweens.add({
            targets: this.sprite,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 500,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: this.sprite,
                    scaleX: 0.9,
                    scaleY: 0.9,
                    duration: 165,
                    ease: 'Cubic.easeIn',
                    onComplete: () => {
                        // Set back to original sprite
                        if (this.sprite && this.sprite.scene) {
                            this.sprite.setFrame('tower1.png');

                            PhaserScene.tweens.add({
                                targets: this.sprite,
                                scaleX: 1.0,
                                scaleY: 1.0,
                                duration: 250,
                                ease: 'Back.easeOut',
                                easeParams: [2.5]
                            });
                        }
                    }
                });
            }
        });
    }
}

// Controller IIFE
const tower = (() => {
    const model = new TowerModel();
    const view = new TowerView();
    let _hurtSoundIndex = 0;
    let _expAtCombatStart = 0;
    let _healingAccumulator = 0;

    function init() {
        view._hitAnimPool = new ObjectPool(
            () => {
                const spr = PhaserScene.add.sprite(0, 0, 'attacks', 'enemy_strike1.png');
                spr.setScale(1.4);
                spr.setDepth(GAME_CONSTANTS.DEPTH_TOWER);
                spr.setVisible(false);
                spr.setActive(false);
                spr.on('animationcomplete', function (anim) {
                    if (anim.key === 'enemy_strike') {
                        view._hitAnimPool.release(spr);
                        spr.setVisible(false);
                        spr.setActive(false);
                    }
                });
                return spr;
            },
            (spr) => { },
            30
        );

        messageBus.subscribe(GAME_CONSTANTS.EVENTS.PHASE_CHANGED, _onPhaseChanged);
        messageBus.subscribe(GAME_CONSTANTS.EVENTS.UPGRADE_PURCHASED, _onUpgradePurchased);
        messageBus.subscribe(GAME_CONSTANTS.EVENTS.STATS_RECALCULATED, _onUpgradePurchased);
        messageBus.subscribe(GAME_CONSTANTS.EVENTS.BOSS_DEFEATED, _onBossDefeated);
        messageBus.subscribe(GAME_CONSTANTS.EVENTS.GAME_PAUSED, () => { model.paused = true; });
        messageBus.subscribe(GAME_CONSTANTS.EVENTS.GAME_RESUMED, () => { model.paused = false; });
        messageBus.subscribe(GAME_CONSTANTS.EVENTS.ENEMY_KILLED, _onEnemyDeath);
        messageBus.subscribe(GAME_CONSTANTS.EVENTS.MINIBOSS_DEFEATED, _onEnemyDeath);
        messageBus.subscribe(GAME_CONSTANTS.EVENTS.BOSS_DEFEATED, _onEnemyDeath);
        messageBus.subscribe(GAME_CONSTANTS.EVENTS.TOWER_SHAKE_REQUESTED, function (duration) {
            view.shake(duration, function () { messageBus.publish(GAME_CONSTANTS.EVENTS.TOWER_SHAKE_COMPLETE); });
        });
        messageBus.subscribe('trackHeal', (amt) => {
            _healingAccumulator += amt;
        });
        messageBus.subscribe('testingDefensesEnded', () => { model.attackTimer = 0; });
        updateManager.addFunction(_update);
        towerStatsUI.init();
    }

    function spawn() {
        model.recalcStats();
        model.health = model.maxHealth;
        model.alive = true;
        model.backupUsed = false;
        model.exp = gameState.exp || 0;

        _expAtCombatStart = model.exp;

        view.spawn(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight);

        messageBus.publish(GAME_CONSTANTS.EVENTS.TOWER_SPAWNED);
        messageBus.publish(GAME_CONSTANTS.EVENTS.HEALTH_CHANGED, model.health, model.maxHealth);
        messageBus.publish(GAME_CONSTANTS.EVENTS.EXP_CHANGED, model.exp, GAME_CONSTANTS.EXP_TO_INSIGHT);
    }

    function awaken() {
        if (model.awakened) return;
        model.awakened = true;

        const pos = view.getPosition();
        view.awaken(pos.x, pos.y, model.attackRange);

        const showRange = (gameState.upgrades && gameState.upgrades.automated_defense >= 1);
        view.updateRangeSprite(showRange ? (model.attackRange / 202) : 0);

        messageBus.publish(GAME_CONSTANTS.EVENTS.TOWER_AWAKENED);
        debugLog('Tower awakened');
    }

    function reset(isIntense = false) {
        model.reset();
        _expAtCombatStart = model.exp;
        if (model.awakened) {
            const showRange = (gameState.upgrades && gameState.upgrades.automated_defense >= 1);
            view.refreshRangeSprite(showRange ? model.attackRange : 0, view.getPosition(), isIntense);
        }
    }

    function takeDamage(amount, x, y) {
        if (!model.alive || model.isInvincible) return true; // Successfully 'survived' because we are invincible/dead

        const damageTaken = Math.max(0, amount - model.armor);
        const survived = model.takeDamage(amount);

        if (damageTaken > 0.5) {
            let volume = 0.9;
            let detune = 25;
            const pct = damageTaken / model.maxHealth;

            if (pct < 0.03) {
                volume = 0.45;
                detune = -200;
            } else if (pct < 0.08) {
                volume = 0.6;
                detune = -75;
            }

            detune += (Math.random() * 30 - 15); // Small random variation

            const key = (_hurtSoundIndex === 0) ? 'tower_hurt' : 'tower_hurt2';
            _hurtSoundIndex = (_hurtSoundIndex + 1) % 2;

            const s = audio.play(key, volume);
            if (s) s.detune = detune;

            // Trigger hit particles: 2 base + 1 per 10% max health lost
            const hitPct = damageTaken / model.maxHealth;
            const particleCount = 2 + Math.floor(hitPct / 0.1);
            const pos = getPosition();
            const px = (x !== undefined) ? x : pos.x;
            const py = (y !== undefined) ? y : pos.y;
            customEmitters.towerHit(px, py, particleCount);
        }

        if (survived) {
            view.playHitFlash();
            zoomShake(1.007);
            // BUG REPORT: Drop 1 DATA on hit + 1 extra per 5 cumulative damage
            const actualDamage = damageTaken * (model.damageReceivedMultiplier || 1);
            if ((gameState.upgrades || {}).bug_report && actualDamage > 0) {
                model.bugReportAccumulator += actualDamage;
                const bonusDrops = Math.floor(model.bugReportAccumulator / 5);
                model.bugReportAccumulator %= 5;

                const dropCount = 1 + bonusDrops;
                const pos = getPosition();
                for (let i = 0; i < dropCount; i++) {
                    const dist = 50 + Math.random() * 120; // 50 min, 170 max
                    resourceManager.spawnDataDrop(pos.x, pos.y, dist);
                }
            }

            // Critical Health Warning Check
            const overclockLv = model.emergencyOverclockLv || 0;
            const threshold = overclockLv > 0 ? 0.50 : 0.20;
            const thresholdValue = (model.maxHealth * threshold) + 0.1;

            if (!model.hasWarnedThisWave && model.health <= thresholdValue) {
                model.hasWarnedThisWave = true;
                if (overclockLv > 0) {
                    view.playWarnShockwave(750, 1.2, 3.3);
                } else {
                    view.playWarnShockwave();
                }
                // Optional: slow down zoom shake slightly to emphasize core hit
                zoomShake(1.015);

                // Hitstop effect — slow down world logic for 300ms real-time
                setTimeout(() => {
                    PhaserScene.time.timeScale = 0.25;
                    PhaserScene.time.delayedCall(300, () => {
                        PhaserScene.time.timeScale = 1.0;
                    });
                }, 40);
            }

            if (x !== undefined && y !== undefined) {
                // Offset 10px closer to tower center
                const cx = GAME_CONSTANTS.halfWidth;
                const cy = GAME_CONSTANTS.halfHeight;
                const dx = cx - x;
                const dy = cy - y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const ox = x + (dx / dist) * 10;
                const oy = y + (dy / dist) * 10;
                view.playHitEffect(ox, oy);
            }
        } else {
            // fatality path
            die();
        }
        return survived;
    }

    function heal(amount) {
        const actual = model.heal(amount);
        if (actual > 0) {
            messageBus.publish(GAME_CONSTANTS.EVENTS.TRACK_HEAL, actual);
        }
    }

    function die() {
        model.die();
        view.cleanupRangeSprite();
        view.playDeathShockwave();
        view.playDeathVisuals();
        debugLog('Tower destroyed');
    }

    function getPosition() {
        return view.getPosition();
    }

    function isAlive() { return model.alive; }
    function getDamage() { return model.damage; }
    function getArmor() { return model.armor; }
    function getRegen() { return model.healthRegen; }
    function getRange() { return model.attackRange; }

    function setVisible(vis) { view.setVisible(vis); }
    function setPosition(x, y) { view.setPosition(x, y); }
    function shake(duration, onComplete) { view.shake(duration, onComplete); }

    function _update(delta) {
        const isTesting = typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses;
        if (!model.alive || (!model.active && !isTesting) || model.paused) return;

        const dt = delta / 1000; // seconds

        // Unified Healing Popup Text (Accumulated from previous frame or multiple calls this frame)
        if (_healingAccumulator > 0) {
            const pos = view.getPosition();
            let healAmountText = Math.floor(_healingAccumulator);
            if (healAmountText === 0 && _healingAccumulator > 0) healAmountText = 1;

            if (healAmountText > 0) {
                floatingText.show(pos.x, pos.y - 35, `+${healAmountText} HEAL`, {
                    fontFamily: 'JetBrainsMono_Bold',
                    fontSize: 28,
                    color: '#00ff66',
                    depth: GAME_CONSTANTS.DEPTH_TOWER,
                    travel: 50,
                    stroke: '#000000',
                    strokeThickness: 2
                });
            }
            _healingAccumulator = 0;
        }

        if (model.active) {
            // Applied health regeneration (Auto-Restore)
            if (model.healthRegen !== 0) {
                model.health += model.healthRegen * dt;
            }
            if (model.health > model.maxHealth) model.health = model.maxHealth;
            if (model.health <= 0) {
                model.health = 0;
                die();
                return;
            }
            messageBus.publish(GAME_CONSTANTS.EVENTS.HEALTH_CHANGED, model.health, model.maxHealth);

            // EXP accumulation
            let expBoost = 1.0;
            const lifetimeInsight = (gameState.stats && gameState.stats.totalInsightEarned) || 0;
            if (lifetimeInsight === 0) expBoost = 1.4;
            else if (lifetimeInsight === 1) expBoost = 1.2;
            else if (lifetimeInsight === 2) expBoost = 1.1;

            // Reduce EXP gain by 50% during endless farming runs
            const currentLevel = gameState.currentLevel || 1;
            const isFarming = (gameState.levelsDefeated || 0) >= currentLevel;
            if (isFarming) expBoost *= 0.5;

            model.exp += (GAME_CONSTANTS.EXP_FILL_RATE * expBoost) * dt;
            if (model.exp >= GAME_CONSTANTS.EXP_TO_INSIGHT) {
                model.exp -= GAME_CONSTANTS.EXP_TO_INSIGHT;
                resourceManager.addInsight(1);
                messageBus.publish(GAME_CONSTANTS.EVENTS.INSIGHT_GAINED);
            }
            gameState.exp = model.exp;
            messageBus.publish(GAME_CONSTANTS.EVENTS.EXP_CHANGED, model.exp, GAME_CONSTANTS.EXP_TO_INSIGHT);
        }

        // Auto-attack
        if (model.awakened && (gameState.upgrades && gameState.upgrades.automated_defense >= 1)) {
            let tick = delta;
            if (model.emergencyOverclockLv > 0 && model.health <= (model.maxHealth * 0.5 + 0.1)) {
                tick *= 2;
            }

            model.attackTimer += tick;
            if (model.attackTimer >= model.attackCooldown) {
                model.attackTimer -= model.attackCooldown;
                _tryAutoAttack();
            }
        }
    }

    function _tryAutoAttack() {
        const pos = view.getPosition();
        const target = enemyManager.getNearestEnemy(pos.x, pos.y, model.attackRange);
        if (!target) return;
        projectileManager.fire(pos.x, pos.y, target.model.x, target.model.y, model.damage);
        view.playRecoil(target.model.x, target.model.y);

        // PRISMATIC ARRAY effect
        const ups = gameState.upgrades || {};
        const prismaticLv = ups.prismatic_array || 0;
        if (prismaticLv > 0) {
            const chance = 0.20 * prismaticLv;
            if (Math.random() < chance) {
                PhaserScene.time.delayedCall(100, () => {
                    const isTesting = typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses;
                    if (!model.alive || (!model.active && !isTesting)) return;
                    const newTarget = enemyManager.getNearestEnemy(pos.x, pos.y, model.attackRange);
                    if (newTarget) {
                        const angle = Math.atan2(newTarget.model.y - pos.y, newTarget.model.x - pos.x) + (Math.random() * 0.06 - 0.03);
                        projectileManager.fire(pos.x, pos.y, pos.x + Math.cos(angle) * 100, pos.y + Math.sin(angle) * 100, model.damage);
                    }
                });
            }
        }
    }

    function _onPhaseChanged(phase) {
        if (phase === GAME_CONSTANTS.PHASE_COMBAT) {
            model.active = true;
            model.attackTimer = 0;
        } else if (phase === GAME_CONSTANTS.PHASE_UPGRADE) {
            model.active = false;
            model.health = model.maxHealth;
            messageBus.publish(GAME_CONSTANTS.EVENTS.HEALTH_CHANGED, model.health, model.maxHealth);
            view.playUpgradePhaseAnimation(model.attackRange);
            if (view.sprite) {
                view.sprite.setAlpha(1);
                view.sprite.clearTint();
            }
        } else if (phase === GAME_CONSTANTS.PHASE_WAVE_COMPLETE) {
            model.active = false;
            if (view.sprite) view.playResetVisuals();
        } else {
            model.active = false;
        }
    }

    function _onUpgradePurchased() {
        model.recalcStats();
        const showRange = (gameState.upgrades && gameState.upgrades.automated_defense >= 1);
        view.updateRangeSprite(showRange ? (model.attackRange / 202) : 0);

        if (!model.active) {
            model.health = model.maxHealth;
            messageBus.publish(GAME_CONSTANTS.EVENTS.HEALTH_CHANGED, model.health, model.maxHealth);
        }

        if (view.sprite) {
            view.sprite.setAlpha(1);
            view.sprite.clearTint();
        }
    }

    function _onBossDefeated() {
        model.isInvincible = true;
        PhaserScene.time.delayedCall(2800, () => {
            model.isInvincible = false;
        });
        debugLog('Tower invincible for 2.8s after boss defeat');
    }

    function _onEnemyDeath(x, y, drop, type, wasResonance = false) {
        if (!model.alive || !model.awakened) return;
        const ups = gameState.upgrades || {};

        // Sustaining Siphon: Heal 1hp on resonance kill
        if (wasResonance && ups.sustaining_siphon) {
            heal(1);
        }

        if (ups.malware_siphon > 0) {
            const towerPos = view.getPosition();
            const dx = x - towerPos.x;
            const dy = y - towerPos.y;
            const distSq = dx * dx + dy * dy;
            const range = model.attackRange + 20;
            if (distSq < range * range) {
                heal(0.5);
                if (typeof customEmitters !== 'undefined') {
                    customEmitters.malwareSiphonFX(x, y, towerPos.x, towerPos.y);
                }
            }
        }
    }

    return {
        init, spawn, awaken, reset,
        takeDamage, heal, die, shake,
        recalcStats: () => model.recalcStats(),
        getPosition, isAlive, getDamage, getArmor, getRegen, getRange,
        getMaxHealth: () => model.maxHealth,
        getHealth: () => model.health,
        resurrect: () => {
            model.resurrect();
            // controller level invincibility is better handled by waveManager or a helper here
        },
        setHealth: (h) => {
            model.health = h;
            messageBus.publish(GAME_CONSTANTS.EVENTS.HEALTH_CHANGED, model.health, model.maxHealth);
        },
        setInvincible: (duration) => {
            model.isInvincible = true;
            PhaserScene.time.delayedCall(duration, () => {
                model.isInvincible = false;
            });
        },
        isBackupUsed: () => model.backupUsed,
        setBackupUsed: (val) => { model.backupUsed = val; },
        isIterativeGrowthUsed: () => model.iterativeGrowthUsed,
        setIterativeGrowthUsed: (val) => { model.iterativeGrowthUsed = val; },
        getExpState: () => ({
            expAtStart: _expAtCombatStart,
            expNow: model.exp,
            sessionInsightCount: resourceManager.getSessionInsight(),
            threshold: GAME_CONSTANTS.EXP_TO_INSIGHT,
        }),
        setVisible, setPosition,
        playArtilleryCall: (fast) => view.playArtilleryCallAnimation(fast),
    };
})();
