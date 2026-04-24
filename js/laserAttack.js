// laserAttack.js — Orbiting laser turret weapon (Tier 3 Duo)
// Activated by the "laser" node.
// An orbiting turret fires a 1000px beam outward for 3.5 seconds, then has a 4s cooldown.

class LaserAttackModel {
    constructor() {
        this.ORBIT_RADIUS = 40;          // px from tower center
        this.ORBIT_SPEED = 0.385;        // radians/second
        this.BEAM_LENGTH = 1000;         // px
        this.BEAM_VISUAL_HALF_WIDTH = 25;// visual beam half-width (50px total)
        this.BEAM_DAMAGE_HALF_WIDTH = 35;// damage half-width (70px total)
        this.BASE_DAMAGE_PER_TICK = 3;
        this.TICK_INTERVAL = 200;        // ms between damage ticks
        this.FIRE_DURATION = 4500;       // ms beam is active
        this.COOLDOWN_DURATION = 4000;   // ms cooldown between fires

        this.active = false;    // true when combat phase AND node purchased
        this.unlocked = false;  // set by unlock()
        this.paused = false;

        // State
        this.angle = 0;          // current orbit angle in radians
        this.firing = false;
        this.fireTimer = 0;      // ms elapsed in current fire phase
        this.cooldownTimer = 0;  // ms elapsed in cooldown
        this.tickTimer = 0;      // ms elapsed since last damage tick
        this.charging = false;   // true during pre-fire visual state

        // Upgrade levels
        this.apertureLevel = 0; // laser_aperture (+60px width)
        this.disintegrationLevel = 0; // laser_disintegration (+1 base damage)
        this.twinLevel = 0;       // laser_twin_beams (dual turret)

        // Visual feedback
        this.tickFlash = 0;       // 0-1, spikes on damage tick, decays quickly
        this.tapering = false;    // true during taper-down phase
        this.taperProgress = 0;   // 0-1, how far through taper-down
        this.TAPER_DURATION = 200; // ms to taper beam down
    }

    getVisualHalfWidth() {
        return this.BEAM_VISUAL_HALF_WIDTH + this.apertureLevel * 30;
    }

    getDamageHalfWidth() {
        return this.BEAM_DAMAGE_HALF_WIDTH + this.apertureLevel * 30;
    }

    getFireDuration() {
        return this.FIRE_DURATION;
    }

    getTurretX(towerX, offset = 0) {
        return towerX + Math.cos(this.angle + offset) * this.ORBIT_RADIUS;
    }
    getTurretY(towerY, offset = 0) {
        return towerY + Math.sin(this.angle + offset) * this.ORBIT_RADIUS;
    }

    getBeamEndX(towerX) {
        return this.getTurretX(towerX) + Math.cos(this.angle) * this.BEAM_LENGTH;
    }

    getBeamEndY(towerY) {
        return this.getTurretY(towerY) + Math.sin(this.angle) * this.BEAM_LENGTH;
    }
}

class LaserAttackView {
    constructor() {
        this._turret = null;
        this._turret2 = null;

        // Beam 1 sprites
        this._glow1 = null;
        this._body1 = null;
        this._core1 = null;

        // Beam 2 sprites (Duo)
        this._glow2 = null;
        this._body2 = null;
        this._core2 = null;

        // Hotspot 1 sprites
        this._hGlow1 = null;
        this._hInner1 = null;
        this._hWhite1 = null;

        // Hotspot 2 sprites
        this._hGlow2 = null;
        this._hInner2 = null;
        this._hWhite2 = null;
        this._jitterValue = 1.0;
        this._jitterTimer = 0;
        this._initialized = false;
    }

    init() {
        const createBeamSet = () => {
            const glow = PhaserScene.add.image(0, 0, 'player', 'laser_glow.png');
            const body = PhaserScene.add.image(0, 0, 'player', 'laser_body.png');
            const core = PhaserScene.add.image(0, 0, 'player', 'laser_core.png');

            [glow, body, core].forEach(s => {
                s.setOrigin(0, 0.5)
                    .setDepth(GAME_CONSTANTS.DEPTH_PROJECTILES - 10)
                    .setBlendMode(Phaser.BlendModes.ADD)
                    .setVisible(false)
                    .setScrollFactor(1);
            });
            return { glow, body, core };
        };

        const createHotspotSet = () => {
            const glow = PhaserScene.add.image(0, 0, 'player', 'outer_glow.png');
            const inner = PhaserScene.add.image(0, 0, 'player', 'inner_core.png');
            const white = PhaserScene.add.image(0, 0, 'player', 'white_center.png');

            [inner, white].forEach(s => {
                s.setDepth(GAME_CONSTANTS.DEPTH_PROJECTILES - 9)
                    .setBlendMode(Phaser.BlendModes.ADD)
                    .setVisible(false)
                    .setScrollFactor(1);
            });

            glow.setDepth(GAME_CONSTANTS.DEPTH_PROJECTILES - 11) // Behind inner core
                .setBlendMode(Phaser.BlendModes.LIGHTEN)
                .setVisible(false)
                .setScrollFactor(1);

            return { glow, inner, white };
        };

        const b1 = createBeamSet();
        this._glow1 = b1.glow;
        this._body1 = b1.body;
        this._core1 = b1.core;

        const b2 = createBeamSet();
        this._glow2 = b2.glow;
        this._body2 = b2.body;
        this._core2 = b2.core;

        const h1 = createHotspotSet();
        this._hGlow1 = h1.glow;
        this._hInner1 = h1.inner;
        this._hWhite1 = h1.white;

        const h2 = createHotspotSet();
        this._hGlow2 = h2.glow;
        this._hInner2 = h2.inner;
        this._hWhite2 = h2.white;

        this._turret = PhaserScene.add.image(0, 0, 'player', 'laser_turret.png');
        this._turret.setDepth(GAME_CONSTANTS.DEPTH_TOWER + 1);
        this._turret.setVisible(false);
        this._turret.setOrigin(0.5, 0.5);
        this._turret.setScale(0.4);

        this._turret2 = PhaserScene.add.image(0, 0, 'player', 'laser_turret.png');
        this._turret2.setDepth(GAME_CONSTANTS.DEPTH_TOWER + 1);
        this._turret2.setVisible(false);
        this._turret2.setOrigin(0.5, 0.5);
        this._turret2.setScale(0.4);

        this._initialized = true;
    }

    show(model) {
        if (!this._initialized) return;
        this._turret.setVisible(true);
        if (model.twinLevel > 0) {
            this._turret2.setVisible(true);
        } else {
            this._turret2.setVisible(false);
        }
    }

    hide() {
        if (!this._initialized) return;
        this._turret.setVisible(false);
        this._turret2.setVisible(false);

        const allSprites = [
            this._glow1, this._body1, this._core1,
            this._glow2, this._body2, this._core2,
            this._hGlow1, this._hInner1, this._hWhite1,
            this._hGlow2, this._hInner2, this._hWhite2
        ];
        allSprites.forEach(s => s && s.setVisible(false));
    }

    update(model, towerX, towerY, delta = 0) {
        if (!this._initialized || !model.unlocked) return;

        const tx = model.getTurretX(towerX);
        const ty = model.getTurretY(towerY);

        this._turret.setPosition(tx, ty);
        this._turret.setRotation(model.angle);
        this._turret.setVisible(true);

        if (model.twinLevel > 0) {
            const tx2 = model.getTurretX(towerX, Math.PI);
            const ty2 = model.getTurretY(towerY, Math.PI);
            this._turret2.setPosition(tx2, ty2);
            this._turret2.setRotation(model.angle + Math.PI);
            this._turret2.setVisible(true);
        } else {
            this._turret2.setVisible(false);
        }

        if (!model.firing && !model.tapering && !model.charging) {
            const allBeamDots = [
                this._glow1, this._body1, this._core1,
                this._glow2, this._body2, this._core2,
                this._hGlow1, this._hInner1, this._hWhite1,
                this._hGlow2, this._hInner2, this._hWhite2
            ];
            allBeamDots.forEach(s => s && s.setVisible(false));
            this._jitterTimer = 0;
            return;
        }

        let alpha = 0.5 + 0.5 * Math.random();
        let currentHalfW;
        if (model.charging) {
            // Sample a new random value only every 16ms (normalize to 60ish fps)
            this._jitterTimer += delta;
            if (this._jitterTimer >= 16) {
                this._jitterTimer -= 16;
                this._jitterValue = 1.0 + (Math.random() * 0.32 - 0.16);
            }
            currentHalfW = model.getVisualHalfWidth() * 0.75 * this._jitterValue;
        } else {
            this._jitterTimer = 0;
            const pulse = 1.0 + 0.15 * Math.pow(1.0 - (model.tickTimer / model.TICK_INTERVAL) || 0, 3);
            const taperMult = model.tapering ? Math.max(0, 1.0 - model.taperProgress) : 1.0;
            currentHalfW = model.getVisualHalfWidth() * pulse * taperMult;
        }

        if (model.charging) {
            // Hide beam sprites during charge
            [this._glow1, this._body1, this._core1, this._glow2, this._body2, this._core2].forEach(s => s && s.setVisible(false));
        }

        if (model.firing || model.tapering) {
            this._updateBeamSet(this._glow1, this._body1, this._core1, tx, ty, model.angle, model.BEAM_LENGTH, currentHalfW, alpha, model);
        }

        this._updateHotspotSet(this._hGlow1, this._hInner1, this._hWhite1, tx, ty, currentHalfW, alpha);

        if (model.twinLevel > 0) {
            const tx2 = model.getTurretX(towerX, Math.PI);
            const ty2 = model.getTurretY(towerY, Math.PI);

            if (model.firing || model.tapering) {
                this._updateBeamSet(this._glow2, this._body2, this._core2, tx2, ty2, model.angle + Math.PI, model.BEAM_LENGTH, currentHalfW, alpha, model);
            }
            this._updateHotspotSet(this._hGlow2, this._hInner2, this._hWhite2, tx2, ty2, currentHalfW, alpha);
        } else {
            [this._glow2, this._body2, this._core2, this._hGlow2, this._hInner2, this._hWhite2].forEach(s => s && s.setVisible(false));
        }
    }

    _updateBeamSet(glow, body, core, x, y, angle, length, halfW, alpha, model) {
        glow.setPosition(x, y).setRotation(angle).setVisible(true).setAlpha(0.25 * alpha);
        body.setPosition(x, y).setRotation(angle).setVisible(true).setAlpha(0.75 * alpha);
        core.setPosition(x, y).setRotation(angle).setVisible(true).setAlpha(0.95 * alpha);

        glow.setDisplaySize(length, halfW * 2.45);
        body.setDisplaySize(length, halfW * 2.3);

        const flashT = model ? model.tickFlash : 0;
        const coreWidthMult = (1.05 + flashT * 0.3) * 1.1;
        core.setDisplaySize(length, halfW * coreWidthMult);
    }

    _updateHotspotSet(glow, inner, white, x, y, halfW, alpha) {
        const radius = halfW * 0.6 + 3;

        glow.setPosition(x, y).setVisible(true).setAlpha(0.4 * alpha).setDisplaySize(radius * 1.91 * 2, radius * 1.91 * 2);
        inner.setPosition(x, y).setVisible(true).setAlpha(0.9 * alpha).setDisplaySize(radius * 2, radius * 2);
        white.setPosition(x, y).setVisible(true).setAlpha(alpha).setDisplaySize(radius * 0.4 * 2, radius * 0.4 * 2);
    }
}

// ── Controller ────────────────────────────────────────────────────────────────

const laserAttack = (() => {
    const model = new LaserAttackModel();
    const view = new LaserAttackView();
    const _hitBuffer = [];
    const _tickHitSet = new Set(); // To prevent double-damaging massive targets
    let _beamSound = null;

    function init() {
        view.init();
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('gamePaused', () => { model.paused = true; });
        messageBus.subscribe('gameResumed', () => { model.paused = false; });
        messageBus.subscribe('testingDefensesStarted', () => {
            model.firing = false;
            model.tapering = false;
            model.charging = false;
            model.cooldownTimer = 1000;
            if (_beamSound) {
                audio.fadeAway(_beamSound, 150);
                _beamSound = null;
            }
            view.hide();
            if (model.unlocked) view.show(model);
        });
        messageBus.subscribe('testingDefensesEnded', () => {
            model.firing = false;
            model.tapering = false;
            model.charging = false;
            model.fireTimer = 0;
            model.cooldownTimer = 0;
            if (_beamSound) {
                audio.fadeAway(_beamSound, 150);
                _beamSound = null;
            }
            view.hide();
            if (model.unlocked) view.show(model);

            // Force one update to clear any remaining beam visuals immediately
            const towerPos = tower.getPosition();
            if (towerPos) view.update(model, towerPos.x, towerPos.y);
        });
        updateManager.addFunction(_update);
    }

    function unlock() {
        model.unlocked = true;
        view.show(model);
        // Start in cooldown so it doesn't fire immediately on unlock
        model.firing = false;
        model.cooldownTimer = 0;
    }

    function lock() {
        model.unlocked = false;
        model.active = false;
        model.firing = false;
        model.charging = false;
        if (_beamSound) {
            audio.fadeAway(_beamSound, 150);
            _beamSound = null;
        }
        view.hide();
    }

    function setLevels({ aperture = 0, disintegration = 0, twin = 0 } = {}) {
        model.apertureLevel = aperture;
        model.disintegrationLevel = disintegration;
        model.twinLevel = twin;
    }

    function _onPhaseChanged(phase) {
        if (phase === GAME_CONSTANTS.PHASE_COMBAT) {
            model.active = true;
            // Begin cooldown at combat start so first shot fires after COOLDOWN_DURATION
            model.firing = false;
            model.charging = false;
            model.cooldownTimer = 1000;
            model.fireTimer = 0;
            model.tickTimer = 0;
            if (model.unlocked) view.show(model);
        } else {
            model.active = false;
            model.firing = false;
            model.charging = false;
            if (_beamSound) {
                audio.fadeAway(_beamSound, 200);
                _beamSound = null;
            }
            view.hide();
            if (model.unlocked) view.show(model); // keep turret visible but beam off
        }
    }

    function _update(delta) {
        if (!model.unlocked) return;
        if (!tower.isAlive()) {
            if (_beamSound) {
                audio.fadeAway(_beamSound, 100);
                _beamSound = null;
            }
            view.hide();
            return;
        }

        const towerPos = tower.getPosition();

        // Always orbit
        if (!model.paused) {
            const speedMult = model.firing ? 1.0 : 0.35;
            model.angle += model.ORBIT_SPEED * speedMult * (delta / 1000);
        }

        view.update(model, towerPos.x, towerPos.y, delta);

        const isTesting = typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses;
        if ((!model.active && !isTesting) || model.paused) return;

        if (model.firing) {
            model.fireTimer += delta;
            model.tickTimer += delta;

            // Damage tick
            while (model.tickTimer >= model.TICK_INTERVAL) {
                model.tickTimer -= model.TICK_INTERVAL;
                model.tickFlash = 1.0; // Spike flash
                _dealDamage(towerPos);
            }

            // Decay tick flash
            if (model.tickFlash > 0) {
                model.tickFlash = Math.max(0, model.tickFlash - delta / 80);
            }

            // End firing phase → begin taper-down
            if (model.fireTimer >= model.getFireDuration()) {
                model.firing = false;
                model.tapering = true;
                model.taperProgress = 0;

                // Reset ramping damage bonus for all enemies when weapon turns off
                const active = enemyManager.getActiveEnemies();
                for (let i = 0; i < active.length; i++) {
                    if (active[i] && active[i].model) {
                        active[i].model.laserDmgBonus = 0;
                    }
                }

                if (_beamSound) {
                    audio.fadeAway(_beamSound, 150);
                    _beamSound = null;
                    audio.play('laser_end', 0.85);
                }
            }
        } else if (model.tapering) {
            // Taper-down phase — shrink beam to 0
            model.taperProgress += delta / model.TAPER_DURATION;
            if (model.taperProgress >= 1.0) {
                model.tapering = false;
                model.taperProgress = 0;
                model.cooldownTimer = 0;
            }
        } else {
            // Cooldown
            model.cooldownTimer += delta;

            // Pre-fire visuals (0.35s before firing)
            model.charging = model.cooldownTimer >= model.COOLDOWN_DURATION - 350;

            if (model.cooldownTimer >= model.COOLDOWN_DURATION) {
                model.charging = false;
                _startFiring();
            }
        }
    }

    function _startFiring() {
        model.firing = true;
        model.fireTimer = 0;
        model.tickTimer = 0;

        view.show(model);
        messageBus.publish('SoundPlay', 'laser_start');

        // Pitfall Fix: Prevent looping sound stacking
        if (_beamSound) {
            audio.fadeAway(_beamSound, 100);
            _beamSound = null;
        }

        let volume = 1.0;
        if (model.apertureLevel > 0) volume += 0.1;
        _beamSound = audio.play('laser_long', volume, true);
    }

    function _dealDamage(towerPos) {
        _tickHitSet.clear();
        const halfDmgW = model.getDamageHalfWidth();
        const dmg = model.BASE_DAMAGE_PER_TICK + model.disintegrationLevel;
        const L = model.BEAM_LENGTH;

        _applyBeamDamage(model.getTurretX(towerPos.x), model.getTurretY(towerPos.y), model.angle, L, halfDmgW, dmg);

        if (model.twinLevel > 0) {
            _applyBeamDamage(model.getTurretX(towerPos.x, Math.PI), model.getTurretY(towerPos.y, Math.PI), model.angle + Math.PI, L, halfDmgW, dmg);
        }
    }

    function _applyBeamDamage(ox, oy, angle, L, halfDmgW, dmg) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // Optimization 3: Broad-phase culling
        // Query enemies in a square that covers the total reach of the beam
        const bx = ox + (cos * L) / 2;
        const by = oy + (sin * L) / 2;
        const searchSize = (L / 2) + halfDmgW + 20;

        const enemies = enemyManager.getEnemiesInSquareRange(bx, by, searchSize, _hitBuffer);
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || !e.model || !e.model.alive || _tickHitSet.has(e)) continue;

            // Project enemy position onto the beam ray
            const ex = e.model.x - ox;
            const ey = e.model.y - oy;

            // t = dot(E, D) clamped to [1, L]
            const t = Math.max(0, Math.min(L, ex * cos + ey * sin));

            // Closest point on beam segment
            const cpx = ox + cos * t;
            const cpy = oy + sin * t;

            if (e.checkCollision(cpx, cpy, 1.0, halfDmgW, 3)) {
                _tickHitSet.add(e);
                const currentBonus = e.model.laserDmgBonus || 0;
                enemyManager.damageEnemy(e, dmg + currentBonus, 'laser');
                e.model.laserDmgBonus = currentBonus + 1;

                // Thermal Overload (guaranteed ignition)
                if (model.incendiaryLevel > 0) {
                    const burnDmg = model.incendiaryLevel * 4;
                    e.applyBurn(3.0, burnDmg);
                }
            }
        }
    }

    return { init, unlock, lock, setLevels };
})();
