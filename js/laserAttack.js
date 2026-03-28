// laserAttack.js — Orbiting laser turret weapon (Tier 3 Duo)
// Activated by the "laser" node.
// An orbiting turret fires a 1000px beam outward for 4 seconds, then has a 6s cooldown.

class LaserAttackModel {
    constructor() {
        this.ORBIT_RADIUS = 40;          // px from tower center
        this.ORBIT_SPEED = 0.41;        // radians/second
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
        this._beamGraphics = null;
        this._initialized = false;
        this._glowGraphics = null;
    }

    init() {
        this._beamGraphics = PhaserScene.add.graphics();
        this._beamGraphics.setDepth(GAME_CONSTANTS.DEPTH_PROJECTILES - 10);
        this._beamGraphics.setBlendMode(Phaser.BlendModes.ADD);
        this._beamGraphics.setVisible(false);

        this._glowGraphics = PhaserScene.add.graphics();
        this._glowGraphics.setDepth(GAME_CONSTANTS.DEPTH_PROJECTILES - 11);
        this._glowGraphics.setBlendMode(Phaser.BlendModes.ADD);
        this._glowGraphics.setVisible(false);

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
        this._beamGraphics.setVisible(false);
        this._glowGraphics.setVisible(false);
        this._beamGraphics.clear();
        this._glowGraphics.clear();
    }

    update(model, towerX, towerY) {
        if (!this._initialized) return;

        const tx = model.getTurretX(towerX);
        const ty = model.getTurretY(towerY);

        // Turret always follows orbit
        this._turret.setPosition(tx, ty);
        this._turret.setRotation(model.angle);
        this._turret.setVisible(true); // Ensure visible when active

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
            this._beamGraphics.setVisible(false);
            this._glowGraphics.setVisible(false);
            this._beamGraphics.clear();
            this._glowGraphics.clear();
            return;
        }

        // Only draw beams if firing or tapering
        const alpha = 0.5 + 0.5 * Math.random();

        // Beam points (laser fires from turret away from tower)
        const bx = tx + Math.cos(model.angle) * model.BEAM_LENGTH;
        const by = ty + Math.sin(model.angle) * model.BEAM_LENGTH;

        // Pulsing: moment of damage should be biggest (tickTimer=0 right after tick)
        const pulse = 1.0 + 0.15 * Math.pow(1.0 - (model.tickTimer / model.TICK_INTERVAL), 3);

        // Taper-down multiplier (shrinks beam width to 0 over TAPER_DURATION)
        const taperMult = model.tapering ? Math.max(0, 1.0 - model.taperProgress) : 1.0;
        const currentHalfW = model.getVisualHalfWidth() * pulse * taperMult;

        this._glowGraphics.setVisible(true);
        this._glowGraphics.clear();
        this._beamGraphics.setVisible(true);
        this._beamGraphics.clear();

        this._drawBeam(tx, ty, bx, by, currentHalfW, alpha, model);
        this._drawOriginHotspot(tx, ty, currentHalfW, alpha);

        if (model.twinLevel > 0) {
            const tx2 = model.getTurretX(towerX, Math.PI);
            const ty2 = model.getTurretY(towerY, Math.PI);
            const bx2 = tx2 + Math.cos(model.angle + Math.PI) * model.BEAM_LENGTH;
            const by2 = ty2 + Math.sin(model.angle + Math.PI) * model.BEAM_LENGTH;
            this._drawBeam(tx2, ty2, bx2, by2, currentHalfW, alpha, model);
            this._drawOriginHotspot(tx2, ty2, currentHalfW, alpha);
        }
    }

    _drawBeam(x1, y1, x2, y2, halfW, alpha, model) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return;

        // Perpendicular vector (normalized)
        const px = -dy / len;
        const py = dx / len;

        // Edge jitter — random ±1.5px offset per vertex for "living energy" feel
        const j = () => (Math.random() - 0.5) * 3;

        // Draw glow (barely wider than beam)
        this._glowGraphics.fillStyle(0x00ffff, 0.2 * alpha);
        this._glowGraphics.fillPoints([
            { x: x1 + px * halfW * 1.25 + j(), y: y1 + py * halfW * 1.25 + j() },
            { x: x2 + px * halfW * 1.25 + j(), y: y2 + py * halfW * 1.25 + j() },
            { x: x2 - px * halfW * 1.25 + j(), y: y2 - py * halfW * 1.25 + j() },
            { x: x1 - px * halfW * 1.25 + j(), y: y1 - py * halfW * 1.25 + j() },
        ], true);

        // Draw main beam (slightly wider)
        const midW = halfW * 1.15;
        this._beamGraphics.fillStyle(0x00ffff, 0.7 * alpha);
        this._beamGraphics.fillPoints([
            { x: x1 + px * midW + j(), y: y1 + py * midW + j() },
            { x: x2 + px * midW + j(), y: y2 + py * midW + j() },
            { x: x2 - px * midW + j(), y: y2 - py * midW + j() },
            { x: x1 - px * midW + j(), y: y1 - py * midW + j() },
        ], true);

        // Inner bright core — flashes white on damage tick
        const coreW = halfW * 0.55;
        const flashT = model ? model.tickFlash : 0;
        const coreColor = flashT > 0.5 ? 0xffffff : 0xe0ffff;
        const coreAlpha = Math.min(1.0, (1.0 + flashT * 0.5)) * alpha;
        const coreWidthMult = 1.0 + flashT * 0.5; // Spike core width on tick

        this._beamGraphics.fillStyle(coreColor, coreAlpha);
        this._beamGraphics.fillPoints([
            { x: x1 + px * coreW * coreWidthMult, y: y1 + py * coreW * coreWidthMult },
            { x: x2 + px * coreW * coreWidthMult, y: y2 + py * coreW * coreWidthMult },
            { x: x2 - px * coreW * coreWidthMult, y: y2 - py * coreW * coreWidthMult },
            { x: x1 - px * coreW * coreWidthMult, y: y1 - py * coreW * coreWidthMult },
        ], true);
    }

    /** Origin hotspot — bright pulsing circle at beam source. */
    _drawOriginHotspot(x, y, halfW, alpha) {
        const radius = halfW * 0.6 + 3;

        // Outer glow ring
        this._glowGraphics.fillStyle(0x00ffff, 0.4 * alpha);
        this._glowGraphics.fillCircle(x, y, radius * 1.8);

        // Inner bright core
        this._beamGraphics.fillStyle(0xe0ffff, 0.9 * alpha);
        this._beamGraphics.fillCircle(x, y, radius);

        // White-hot center
        this._beamGraphics.fillStyle(0xffffff, alpha);
        this._beamGraphics.fillCircle(x, y, radius * 0.4);
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

        if (!model.active || model.paused) return;

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
