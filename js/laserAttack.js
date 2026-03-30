// laserAttack.js — Orbiting laser turret weapon (Tier 3 Duo)
// Activated by the "laser" node.
// An orbiting turret fires a 1000px beam outward for 4 seconds, then has a 6s cooldown.

class LaserAttackModel {
    constructor() {
        this.ORBIT_RADIUS = 40;          // px from tower center
        this.ORBIT_SPEED = 0.4;        // radians/second
        this.BEAM_LENGTH = 1000;         // px
        this.BEAM_VISUAL_HALF_WIDTH = 25;// visual beam half-width (50px total)
        this.BEAM_DAMAGE_HALF_WIDTH = 35;// damage half-width (70px total)
        this.BASE_DAMAGE_PER_TICK = 8;
        this.TICK_INTERVAL = 200;        // ms between damage ticks
        this.FIRE_DURATION = 3000;       // ms beam is active
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

        // Upgrade levels
        this.durationLevel = 0; // laser_duration (+0.5s per level)
        this.apertureLevel = 0; // laser_aperture (+60px width)
        this.incendiaryLevel = 0; // laser_incendiary (ignite chance)
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
        return this.FIRE_DURATION + this.durationLevel * 400;
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

        this._originGraphics = null; // Still use graphics for hotspot
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

        const b1 = createBeamSet();
        this._glow1 = b1.glow;
        this._body1 = b1.body;
        this._core1 = b1.core;

        const b2 = createBeamSet();
        this._glow2 = b2.glow;
        this._body2 = b2.body;
        this._core2 = b2.core;

        // Still using graphics for orig hotspot for now as requested
        this._originGraphics = PhaserScene.add.graphics();
        this._originGraphics.setDepth(GAME_CONSTANTS.DEPTH_PROJECTILES - 9);
        this._originGraphics.setBlendMode(Phaser.BlendModes.ADD);
        this._originGraphics.setVisible(false);

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
        this._originGraphics.setVisible(false);
        this._originGraphics.clear();

        [this._glow1, this._body1, this._core1, this._glow2, this._body2, this._core2].forEach(s => s.setVisible(false));
    }

    update(model, towerX, towerY) {
        if (!this._initialized) return;

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

        if (!model.firing && !model.tapering) {
            // Hide beam and hotspot, but NOT turrets
            this._originGraphics.setVisible(false);
            this._originGraphics.clear();
            [this._glow1, this._body1, this._core1, this._glow2, this._body2, this._core2].forEach(s => s.setVisible(false));
            return;
        }

        const alpha = 0.5 + 0.5 * Math.random();
        const pulse = 1.0 + 0.15 * Math.pow(1.0 - (model.tickTimer / model.TICK_INTERVAL), 3);
        const taperMult = model.tapering ? Math.max(0, 1.0 - model.taperProgress) : 1.0;
        const currentHalfW = model.getVisualHalfWidth() * pulse * taperMult;

        this._originGraphics.setVisible(true);
        this._originGraphics.clear();

        this._updateBeamSet(this._glow1, this._body1, this._core1, tx, ty, model.angle, model.BEAM_LENGTH, currentHalfW, alpha, model);
        this._drawOriginHotspot(tx, ty, currentHalfW, alpha);

        if (model.twinLevel > 0) {
            const tx2 = model.getTurretX(towerX, Math.PI);
            const ty2 = model.getTurretY(towerY, Math.PI);
            this._updateBeamSet(this._glow2, this._body2, this._core2, tx2, ty2, model.angle + Math.PI, model.BEAM_LENGTH, currentHalfW, alpha, model);
            this._drawOriginHotspot(tx2, ty2, currentHalfW, alpha);
        } else {
            [this._glow2, this._body2, this._core2].forEach(s => s.setVisible(false));
        }
    }

    _updateBeamSet(glow, body, core, x, y, angle, length, halfW, alpha, model) {
        glow.setPosition(x, y).setRotation(angle).setVisible(true).setAlpha(0.25 * alpha);
        body.setPosition(x, y).setRotation(angle).setVisible(true).setAlpha(0.75 * alpha);
        core.setPosition(x, y).setRotation(angle).setVisible(true).setAlpha(0.95 * alpha);

        // Multipliers match the original graphics code style
        glow.setDisplaySize(length, halfW * 2.5);
        body.setDisplaySize(length, halfW * 2.3);

        const flashT = model ? model.tickFlash : 0;
        const coreWidthMult = (1.0 + flashT * 0.5) * 1.1; // Spike and default thicc core
        core.setDisplaySize(length, halfW * coreWidthMult);
    }

    /** Origin hotspot — bright pulsing circle at beam source. */
    _drawOriginHotspot(x, y, halfW, alpha) {
        const radius = halfW * 0.6 + 3;

        // Outer glow ring
        this._originGraphics.fillStyle(0x00ffff, 0.4 * alpha);
        this._originGraphics.fillCircle(x, y, radius * 1.8);

        // Inner bright core
        this._originGraphics.fillStyle(0xe0ffff, 0.9 * alpha);
        this._originGraphics.fillCircle(x, y, radius);

        // White-hot center
        this._originGraphics.fillStyle(0xffffff, alpha);
        this._originGraphics.fillCircle(x, y, radius * 0.4);
    }
}

// ── Controller ────────────────────────────────────────────────────────────────

const laserAttack = (() => {
    const model = new LaserAttackModel();
    const view = new LaserAttackView();
    const _hitBuffer = [];
    let _beamSound = null;

    function init() {
        view.init();
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('gamePaused', () => { model.paused = true; });
        messageBus.subscribe('gameResumed', () => { model.paused = false; });
        messageBus.subscribe('testingDefensesStarted', () => {
            model.firing = false;
            model.tapering = false;
            model.cooldownTimer = 0;
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
            model.cooldownTimer = 0;
            if (_beamSound) {
                audio.fadeAway(_beamSound, 150);
                _beamSound = null;
            }
            view.hide();
            if (model.unlocked) view.show(model);
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
        if (_beamSound) {
            audio.fadeAway(_beamSound, 150);
            _beamSound = null;
        }
        view.hide();
    }

    function setLevels({ duration = 0, aperture = 0, incendiary = 0, twin = 0 } = {}) {
        model.durationLevel = duration;
        model.apertureLevel = aperture;
        model.incendiaryLevel = incendiary;
        model.twinLevel = twin;
    }

    function _onPhaseChanged(phase) {
        if (phase === GAME_CONSTANTS.PHASE_COMBAT) {
            model.active = true;
            // Begin cooldown at combat start so first shot fires after COOLDOWN_DURATION
            model.firing = false;
            model.cooldownTimer = 0;
            model.fireTimer = 0;
            model.tickTimer = 0;
            if (model.unlocked) view.show(model);
        } else {
            model.active = false;
            model.firing = false;
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

        view.update(model, towerPos.x, towerPos.y);

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
            if (model.cooldownTimer >= model.COOLDOWN_DURATION) {
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

        let volume = 1.0;
        if (model.apertureLevel > 0) volume += 0.1;
        _beamSound = audio.play('laser_long', volume, true);
    }

    function _dealDamage(towerPos) {
        const halfDmgW = model.getDamageHalfWidth();
        const dmg = model.BASE_DAMAGE_PER_TICK;
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

            // Project enemy position onto the beam ray
            const ex = e.model.x - ox;
            const ey = e.model.y - oy;

            // t = dot(E, D) clamped to [1, L]
            const t = Math.max(0, Math.min(L, ex * cos + ey * sin));

            // Closest point on beam segment
            const cpx = ox + cos * t;
            const cpy = oy + sin * t;

            // Optimization 2: Squared distance comparison (avoids expensive Math.sqrt)
            const dx = e.model.x - cpx;
            const dy = e.model.y - cpy;
            const reach = halfDmgW + (e.model.size || 0);

            if ((dx * dx + dy * dy) < (reach * reach)) {
                enemyManager.damageEnemy(e, dmg, 'laser');

                // Thermal Overload (guaranteed ignition)
                if (model.incendiaryLevel > 0) {
                    const burnDmg = model.incendiaryLevel * 4;
                    e.applyBurn(4.0, burnDmg);
                }
            }
        }
    }

    return { init, unlock, lock, setLevels };
})();
