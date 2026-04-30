// js/scytheAttack.js — Scythe sweeping attack from the tower.
// Attacks in a 110-degree arc every 2s, damaging enemies in a radial range.
// Activated/deactivated by duo-box swap.

class ScytheAttackModel {
    constructor() {
        this.FIRE_INTERVAL = 2000;  // ms between swings
        this.BASE_DAMAGE = 20;
        this.SEARCH_RANGE = 400;    // max distance to search for targets
        this.INNER_RANGE = 190;     // inner radius of the sweep arc
        this.OUTER_RANGE = 330;     // outer radius of the sweep arc
        this.ARC_ANGLE = 110;       // sweep arc in degrees
        this.HIT_DELAY = 350;       // ms delay before hit occurs (warning phase)

        this.active = false;
        this.unlocked = false;
        this.paused = false;
        this.damage = this.BASE_DAMAGE;
        this.fireTimer = 1000;      // Start with 1s lead
        this.isSwinging = false;
        this.swingDirection = 1; // 1 for CW, -1 for CCW (logic stub)
        this.harvestLevel = 0;
        this.lethalityLevel = 0;
    }

    resetTimer() {
        this.fireTimer = 1000; // Reset with 1s lead
        this.isSwinging = false;
    }

    updateTimer(delta) {
        this.fireTimer += delta;
        if (this.fireTimer >= this.FIRE_INTERVAL) {
            return true;
        }
        return false;
    }
}

class ScytheAttackView {
    constructor() {
        this.sprite = null;
    }

    init() {
        // sweep.png from 'player' atlas
        this.sprite = PhaserScene.add.image(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, 'player', 'sweep.png');
        this.sprite.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES + 10);
        this.sprite.setVisible(false);
        this.sprite.setOrigin(0.5, 0.5); // Centered on tower
        // Removed setScrollFactor(0) to keep it in world space with the tower
    }

    showWarning(angle, x, y, duration) {
        this.sprite.setPosition(x, y);
        this.sprite.setRotation(angle);
        this.sprite.setVisible(true);
        this.sprite.setAlpha(0.15); // Start alpha

        // Gradually increase alpha over the warning duration
        if (this.alphaTween) this.alphaTween.stop();
        this.alphaTween = PhaserScene.tweens.add({
            targets: this.sprite,
            alpha: 0.75,
            duration: duration,
            ease: 'Back.easeOut'
        });
    }

    showHit() {
        if (this.alphaTween) this.alphaTween.stop();
        if (this.scaleTween) this.scaleTween.stop();

        this.sprite.setAlpha(1.0);
        this.sprite.setScale(1.05);

        // Scale Bounce (Tiny impact feel)
        this.scaleTween = PhaserScene.tweens.add({
            targets: this.sprite,
            scaleX: 1,
            scaleY: 1,
            duration: 250,
            easeParams: [3],
            ease: 'Back.easeOut'
        });

        // Quad.easeIn Fade Out
        this.alphaTween = PhaserScene.tweens.add({
            targets: this.sprite,
            alpha: 0,
            duration: 250,
            ease: 'Quad.easeIn',
            onComplete: () => {
                this.sprite.setVisible(false);
            }
        });
    }

    hide() {
        if (this.alphaTween) this.alphaTween.stop();
        if (this.scaleTween) this.scaleTween.stop();
        this.sprite.setVisible(false);
    }
}

const scytheAttack = (() => {
    const model = new ScytheAttackModel();
    const view = new ScytheAttackView();

    function init() {
        view.init();
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('gamePaused', () => { model.paused = true; });
        messageBus.subscribe('gameResumed', () => { model.paused = false; });
        messageBus.subscribe('testingDefensesStarted', () => { model.resetTimer(); });
        messageBus.subscribe('testingDefensesEnded', () => { model.resetTimer(); });
        updateManager.addFunction(_update);
    }

    function unlock() {
        model.unlocked = true;
        if (gameStateMachine.getPhase() === GAME_CONSTANTS.PHASE_COMBAT) {
            model.active = true;
            model.resetTimer();
        }
    }

    function lock() {
        model.unlocked = false;
        model.active = false;
        view.hide();
    }



    function _update(delta) {
        const isTesting = typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses;
        if (!model.unlocked || model.paused || (!model.active && !isTesting) || !tower.isAlive()) return;

        if (model.updateTimer(delta)) {
            _attemptFire();
        }
    }

    function _attemptFire() {
        if (model.isSwinging) return; // Safety check

        const pos = tower.getPosition();
        if (!pos) return;

        // Optimization: Only scan enemies within search range using spatial grid
        const enemies = enemyManager.getEnemiesInRange(pos.x, pos.y, model.SEARCH_RANGE);
        if (!enemies || enemies.length === 0) {
            model.fireTimer = 0; // Skip and try again next full cooldown
            return;
        }

        const validTargets = [];
        let nearestMissEnemy = null;
        let minMissDist = Infinity;
        let nearestMissAngle = 0;

        // Lead time for expected position (user adjusted to 0.5x delay)
        const LEAD_TIME = (model.HIT_DELAY / 1000) * 0.5;

        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e.model.alive) continue;

            // Calculate expected position (accounting for current slows/hit-stop)
            const moveMult = (e.model.forceSlowMult || 1.0) * (e.model.hitStopTimer > 0 ? 0.1 : 1.0);
            const expX = e.model.x + (e.model.vx || 0) * LEAD_TIME * moveMult;
            const expY = e.model.y + (e.model.vy || 0) * LEAD_TIME * moveMult;

            const dx = expX - pos.x;
            const dy = expY - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Radial range check (190-330) with enemy size leeway
            const sizeLeeway = e.model.size || 15;
            const inRadialRange = (dist + sizeLeeway >= model.INNER_RANGE) && (dist - sizeLeeway <= model.OUTER_RANGE);

            const angle = Math.atan2(dy, dx);

            if (inRadialRange) {
                validTargets.push({ enemy: e, angle: angle });
            } else if (validTargets.length === 0) {
                // Only track nearest miss if no valid targets found so far
                let missDist = 0;
                if (dist < model.INNER_RANGE) missDist = model.INNER_RANGE - (dist + sizeLeeway);
                else missDist = (dist - sizeLeeway) - model.OUTER_RANGE;

                if (missDist < minMissDist) {
                    minMissDist = missDist;
                    nearestMissEnemy = e;
                    nearestMissAngle = angle;
                }
            }
        }

        if (validTargets.length > 0) {
            // SMARTER TARGETING: Find the angle that hits the MOST enemies
            let bestAngle = 0;
            let maxHits = -1;
            const arcHalfRad = Phaser.Math.DegToRad(model.ARC_ANGLE / 2);

            for (let i = 0; i < validTargets.length; i++) {
                const centerAngle = validTargets[i].angle;
                let hitCount = 0;

                for (let j = 0; j < validTargets.length; j++) {
                    const diff = Math.abs(Phaser.Math.Angle.ShortestBetween(centerAngle, validTargets[j].angle));
                    if (diff <= arcHalfRad) {
                        // Count bosses and minibosses as 2 targets to prioritize them
                        const targetEnemy = validTargets[j].enemy;
                        const weight = (targetEnemy.model.isBoss || targetEnemy.model.isMiniboss) ? 2 : 1;
                        hitCount += weight;
                    }
                }

                if (hitCount > maxHits) {
                    maxHits = hitCount;
                    bestAngle = centerAngle;
                }

                // Early Exit: If we found a cluster of 7+, that's good enough
                if (maxHits > 6) break;
            }

            model.fireTimer -= model.FIRE_INTERVAL;
            _fireSequence(bestAngle, pos);
        } else if (nearestMissEnemy) {
            // Fallback to nearest miss if no valid targets found
            model.fireTimer -= model.FIRE_INTERVAL;
            _fireSequence(nearestMissAngle, pos);
        } else {
            // No enemies within 400 units: Skip and reset timer
            model.fireTimer = 0;
        }
    }

    function _fireSequence(angle, pos) {
        if (!tower.isAlive()) {
            model.isSwinging = false;
            return;
        }

        model.isSwinging = true;

        // Warning phase (transparent sprite gradually getting opaque)
        view.showWarning(angle, pos.x, pos.y, model.HIT_DELAY);

        PhaserScene.time.delayedCall(model.HIT_DELAY, () => {
            // Re-check game state after delay
            const isTesting = typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses;
            if (!model.active && !isTesting) {
                view.hide();
                model.isSwinging = false;
                return;
            }

            // Hit phase (full brightness + bounce + fade)
            view.showHit();
            _applyHit(angle, pos);

            // Logic stub for alternating swings
            // model.swingDirection *= -1; 

            // Cleanup swinging state shortly after hit
            PhaserScene.time.delayedCall(150, () => {
                model.isSwinging = false;
            });
        });
    }

    function _applyHit(centerAngle, pos) {
        // Optimization: Only scan enemies within scythe reach (plus 10 unit buffer)
        const enemies = enemyManager.getEnemiesInRange(pos.x, pos.y, model.OUTER_RANGE + 10);

        // Feedback
        if (typeof zoomShake !== 'undefined') zoomShake(1.006);
        if (typeof audio !== 'undefined') {
            const s = audio.play('whoosh', 0.8);
            if (s) s.detune = Phaser.Math.Between(-150, 50);
        }

        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e.model.alive) continue;

            const dx = e.model.x - pos.x;
            const dy = e.model.y - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Accurate Hit Check: Radial (with 10 unit buffer) + Angular (110deg)
            const innerBuffer = model.INNER_RANGE - 10;
            const outerBuffer = model.OUTER_RANGE + 10;

            if (dist < innerBuffer || dist > outerBuffer) continue;

            const angle = Math.atan2(dy, dx);
            const diff = Phaser.Math.Angle.ShortestBetween(Phaser.Math.RadToDeg(centerAngle), Phaser.Math.RadToDeg(angle));

            // Include size leeway in hit detection for consistency with targeting (plus 10 unit buffer)
            const sizeLeeway = e.model.size || 15;
            const inRadialRange = (dist + sizeLeeway >= innerBuffer) && (dist - sizeLeeway <= outerBuffer);

            if (inRadialRange && Math.abs(diff) <= model.ARC_ANGLE / 2) {
                let finalDmg = model.damage;
                if (model.lethalityLevel > 0 && e.model.health < e.model.maxHealth * 0.505) {
                    finalDmg += 10 * model.lethalityLevel;
                }

                enemyManager.damageEnemy(e, finalDmg, 'scythe');

                // HARVEST: Heal on kill
                if (!e.model.alive && model.harvestLevel > 0) {
                    tower.heal(model.harvestLevel);
                }
            }
        }
    }

    function _onPhaseChanged(phase) {
        const isCombat = phase === GAME_CONSTANTS.PHASE_COMBAT;
        if (isCombat && model.unlocked) {
            model.active = true;
            model.resetTimer();
        } else {
            model.active = false;
            view.hide();
        }
    }

    function getModel() { return model; }
    function setDamage(dmg) { model.damage = dmg; }
    function setFireInterval(interval) { model.FIRE_INTERVAL = interval; }
    function setArcAngle(angle) { model.ARC_ANGLE = angle; }
    function setHarvestLevel(level) { model.harvestLevel = level; }
    function setLethalityLevel(level) { model.lethalityLevel = level; }

    return { init, unlock, lock, setDamage, setFireInterval, setArcAngle, setHarvestLevel, setLethalityLevel, getModel };
})();
