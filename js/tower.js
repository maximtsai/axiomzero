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

        this.alive = false;
        this.active = false;       // true only during COMBAT_PHASE
        this.isInvincible = false;       // true briefly after a boss is defeated
        this.awakened = false; // true after awaken() is called
        this.paused = false;
    }

    recalcStats() {
        const ups = gameState.upgrades || {};
        const integrityLv = ups.integrity || 0;
        const intensityLv = ups.intensity || 0;
        const regenLv = ups.regen || 0;
        const focusLv = ups.focus || 0;
        const focus2Lv = ups.focus_range_2 || 0;
        const focus3Lv = ups.focus_range_3 || 0;
        const armorLv = ups.armor || 0;
        const baseHpLv = ups.base_hp_boost || 0;
        const overclockLv = ups.overclock || 0;
        const anchorHp = (ups.physical_anchor || 0) * 40;

        const systemRedundancyLv = ups.system_redundancy_new || 0;
        this.maxHealth = GAME_CONSTANTS.TOWER_BASE_HEALTH + 4 * integrityLv + 10 * systemRedundancyLv + anchorHp;
        const shellDamage = (ups.shell_access || 0) * 4 + baseHpLv * 4;

        this.damage = GAME_CONSTANTS.TOWER_BASE_DAMAGE + 2 * intensityLv + shellDamage;

        this.attackRange = GAME_CONSTANTS.TOWER_ATTACK_RANGE * (1 + 0.2 * focusLv + 0.2 * focus2Lv + 0.2 * focus3Lv);
        const lvlCfg = getCurrentLevelConfig();
        const baseDecay = lvlCfg.healthDecay || 0;
        this.healthRegen = baseDecay + 0.2 * regenLv;
        this.armor = armorLv * 2; // 2 flat damage reduction per level
        this.attackCooldown = GAME_CONSTANTS.TOWER_ATTACK_COOLDOWN * (1 - 0.05 * overclockLv);
    }

    reset() {
        this.recalcStats();
        this.health = this.maxHealth;
        this.alive = true;
        this.attackTimer = 0;
        // EXP no longer resets between waves
        this.isInvincible = false;
        messageBus.publish('healthChanged', this.health, this.maxHealth);
        messageBus.publish('expChanged', this.exp, GAME_CONSTANTS.EXP_TO_INSIGHT);
    }

    takeDamage(amount) {
        if (!this.alive || this.isInvincible) return false;

        let reducedAmount = Math.max(0, amount - this.armor);
        this.health -= reducedAmount;
        if (this.health <= 0) {
            this.health = 0;
            this.die();
            return false; // Did not survive
        }
        messageBus.publish('healthChanged', this.health, this.maxHealth);
        return true; // Survived and took damage
    }

    heal(amount) {
        if (!this.alive) return;
        this.health = Math.min(this.health + amount, this.maxHealth);
        messageBus.publish('healthChanged', this.health, this.maxHealth);
    }

    die() {
        this.alive = false;
        this.active = false;
        this.isInvincible = false;
        messageBus.publish('healthChanged', this.health, this.maxHealth);
        messageBus.publish('towerDied');
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
        this.deathShockwave.setDepth(0).setAlpha(0);

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
        this.rangeSprite.setAlpha(0.40 / 3);
        this.rangeSprite.setScale(rangeScale * 0.2);
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

        // Alpha animation: dim → full → bright → back to dim
        PhaserScene.tweens.add({
            targets: this.rangeSprite,
            alpha: 0.40,
            duration: 450,
            ease: 'Cubic.easeOut',
            completeDelay: 100,
        });

        const overshoot = isIntense ? 1.14 : 1.1;
        const shakeMag = isIntense ? 0.003 : 0.002;

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
                        PhaserScene.cameras.main.shake(80, shakeMag);
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
        if (this.rangeSprite) {
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
        const rx2 = cx - (dx / dist) * recoilDist * -0.6;
        const ry2 = cy - (dy / dist) * recoilDist * -0.6;
        // Kill existing recoil tweens
        PhaserScene.tweens.killTweensOf([this.sprite, this.glowSprite], ['x', 'y']);

        PhaserScene.tweens.add({
            targets: [this.sprite, this.glowSprite],
            x: rx,
            y: ry,
            duration: 150,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: [this.sprite, this.glowSprite],
                    x: cx,
                    y: cy,
                    duration: 250,
                    ease: 'Back.easeOut',
                    easeParams: [2.5]
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
            this.deathShockwave.setDepth(0).setScrollFactor(0).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
        }
        // Reset and trigger
        this.deathShockwave.setVisible(true).setAlpha(1).setScale(0.1);

        // Environment grid pulse via glitch system
        if (typeof glitchFX !== 'undefined') {
            glitchFX.triggerDeathGrid(duration);
        }

        PhaserScene.tweens.add({
            targets: this.deathShockwave,
            scale: 2,
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
}

// Controller IIFE
const tower = (() => {
    const model = new TowerModel();
    const view = new TowerView();
    let _hurtSoundIndex = 0;

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

        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('upgradePurchased', _onUpgradePurchased);
        messageBus.subscribe('statsRecalculated', _onUpgradePurchased);
        messageBus.subscribe('bossDefeated', _onBossDefeated);
        messageBus.subscribe('gamePaused', () => { model.paused = true; });
        messageBus.subscribe('gameResumed', () => { model.paused = false; });
        messageBus.subscribe('enemyKilled', _onEnemyDeath);
        messageBus.subscribe('minibossDefeated', _onEnemyDeath);
        messageBus.subscribe('bossDefeated', _onEnemyDeath);
        messageBus.subscribe('towerShakeRequested', function (duration) {
            view.shake(duration, function () { messageBus.publish('towerShakeComplete'); });
        });
        messageBus.subscribe('testingDefensesEnded', () => { model.attackTimer = 0; });
        updateManager.addFunction(_update);
    }

    function spawn() {
        model.recalcStats();
        model.health = model.maxHealth;
        model.alive = true;
        model.exp = gameState.exp || 0;

        view.spawn(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight);

        messageBus.publish('towerSpawned');
        messageBus.publish('healthChanged', model.health, model.maxHealth);
        messageBus.publish('expChanged', model.exp, GAME_CONSTANTS.EXP_TO_INSIGHT);
    }

    function awaken() {
        if (model.awakened) return;
        model.awakened = true;

        const pos = view.getPosition();
        view.awaken(pos.x, pos.y, model.attackRange);

        messageBus.publish('towerAwakened');
        debugLog('Tower awakened');
    }

    function reset(isIntense = false) {
        model.reset();
        if (model.awakened) {
            view.refreshRangeSprite(model.attackRange, view.getPosition(), isIntense);
        }
    }

    function takeDamage(amount, x, y) {
        const canTakeDamage = model.alive && !model.isInvincible;
        const damageTaken = Math.max(0, amount - model.armor);
        const survived = model.takeDamage(amount);

        if (canTakeDamage && damageTaken > 0.5) {
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
        }

        if (survived) {
            view.playHitFlash();
            zoomShake(1.007);
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
    }

    function heal(amount) {
        model.heal(amount);
    }

    function die() {
        model.die();
        view.cleanupRangeSprite();
        view.playDeathShockwave();
        debugLog('Tower destroyed');
    }

    function getPosition() {
        return view.getPosition();
    }

    function isAlive() { return model.alive; }
    function getDamage() { return model.damage; }

    function setVisible(vis) { view.setVisible(vis); }
    function setPosition(x, y) { view.setPosition(x, y); }
    function shake(duration, onComplete) { view.shake(duration, onComplete); }

    function _update(delta) {
        const isTesting = typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses;
        if (!model.alive || (!model.active && !isTesting) || model.paused) return;

        const dt = delta / 1000; // seconds

        if (model.active) {
            // Negative health regen — skip decay if invincible (victory sequence)
            if (!(model.isInvincible && model.healthRegen < 0)) {
                model.health += model.healthRegen * dt;
            }
            if (model.health > model.maxHealth) model.health = model.maxHealth;
            if (model.health <= 0) {
                model.health = 0;
                model.die();
                view.cleanupRangeSprite();
                view.playDeathShockwave();
                debugLog('Tower destroyed');
                return;
            }
            messageBus.publish('healthChanged', model.health, model.maxHealth);

            // EXP accumulation
            let expBoost = 1.0;
            const lifetimeInsight = (gameState.stats && gameState.stats.totalInsightEarned) || 0;
            if (lifetimeInsight === 0) expBoost = 1.4;
            else if (lifetimeInsight === 1) expBoost = 1.2;
            else if (lifetimeInsight === 2) expBoost = 1.1;

            model.exp += (GAME_CONSTANTS.EXP_FILL_RATE * expBoost) * dt;
            if (model.exp >= GAME_CONSTANTS.EXP_TO_INSIGHT) {
                model.exp -= GAME_CONSTANTS.EXP_TO_INSIGHT;
                resourceManager.addInsight(1);
                messageBus.publish('insightGained');
                audio.play('levelup', 1.0, false);
                const towerPos = view.getPosition();
                floatingText.show(towerPos.x, towerPos.y - 15, t('popup', 'insight_gained'), {
                    fontFamily: 'JetBrainsMono_Bold',
                    fontSize: 22,
                    color: '#ffe600',
                    depth: GAME_CONSTANTS.DEPTH_TOWER,
                });
            }
            gameState.exp = model.exp;
            messageBus.publish('expChanged', model.exp, GAME_CONSTANTS.EXP_TO_INSIGHT);
        }

        // Auto-attack
        if (model.awakened) {
            model.attackTimer += delta;
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
            messageBus.publish('healthChanged', model.health, model.maxHealth);
            view.playUpgradePhaseAnimation(model.attackRange);
            if (view.sprite) {
                view.sprite.setAlpha(1);
                view.sprite.clearTint();
            }
        } else {
            model.active = false;
        }
    }

    function _onUpgradePurchased() {
        model.recalcStats();
        view.updateRangeSprite(model.attackRange / 202);

        if (!model.active) {
            model.health = model.maxHealth;
            messageBus.publish('healthChanged', model.health, model.maxHealth);
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

    function _onEnemyDeath(x, y) {
        if (!model.alive || !model.awakened) return;
        const ups = gameState.upgrades || {};
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
        getPosition, isAlive, getDamage,
        getMaxHealth: () => model.maxHealth,
        getHealth: () => model.health,
        setVisible, setPosition,
        playArtilleryCall: (fast) => view.playArtilleryCallAnimation(fast),
    };
})();
