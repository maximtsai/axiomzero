// laserAttack.js — Orbiting laser turret weapon (Tier 3 Duo)
// Activated by the "laser" node.
// An orbiting turret fires a 1000px beam outward for 4 seconds, then has a 6s cooldown.

class LaserAttackModel {
    constructor() {
        this.ORBIT_RADIUS = 40;          // px from tower center
        this.ORBIT_SPEED = 0.4;        // radians/second
        this.BEAM_LENGTH = 1000;         // px
        this.BEAM_VISUAL_HALF_WIDTH = 20;// visual beam half-width (40px total)
        this.BEAM_DAMAGE_HALF_WIDTH = 30;// damage half-width (60px total)
        this.BASE_DAMAGE_PER_TICK = 1;
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
    }

    getVisualHalfWidth() {
        return this.BEAM_VISUAL_HALF_WIDTH + this.apertureLevel * 30;
    }

    getDamageHalfWidth() {
        return this.BEAM_DAMAGE_HALF_WIDTH + this.apertureLevel * 30;
    }

    getFireDuration() {
        return this.FIRE_DURATION + this.durationLevel * 500;
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
        this._beamGraphics.setVisible(false);

        this._glowGraphics = PhaserScene.add.graphics();
        this._glowGraphics.setDepth(GAME_CONSTANTS.DEPTH_PROJECTILES - 11);
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

        if (model.twinLevel > 0) {
            const tx2 = model.getTurretX(towerX, Math.PI);
            const ty2 = model.getTurretY(towerY, Math.PI);
            this._turret2.setPosition(tx2, ty2);
            this._turret2.setRotation(model.angle + Math.PI);
            this._turret2.setVisible(true);
        } else {
            this._turret2.setVisible(false);
        }

        if (!model.firing) {
            this._beamGraphics.setVisible(false);
            this._glowGraphics.setVisible(false);
            this._beamGraphics.clear();
            this._glowGraphics.clear();
            return;
        }

        // Only draw beams if firing
        const alpha = 0.5 + 0.5 * Math.random(); 
        
        // Beam points (laser fires from turret away from tower)
        const bx = tx + Math.cos(model.angle) * model.BEAM_LENGTH;
        const by = ty + Math.sin(model.angle) * model.BEAM_LENGTH;

        // Pulsing: moment of damage should be biggest (tickTimer=0 right after tick)
        const pulse = 1.0 + 0.15 * Math.pow(1.0 - (model.tickTimer / model.TICK_INTERVAL), 3);
        const currentHalfW = model.getVisualHalfWidth() * pulse;

        this._glowGraphics.setVisible(true);
        this._glowGraphics.clear();
        this._beamGraphics.setVisible(true);
        this._beamGraphics.clear();

        this._drawBeam(tx, ty, bx, by, currentHalfW, alpha);

        if (model.twinLevel > 0) {
            const tx2 = model.getTurretX(towerX, Math.PI);
            const ty2 = model.getTurretY(towerY, Math.PI);
            const bx2 = tx2 + Math.cos(model.angle + Math.PI) * model.BEAM_LENGTH;
            const by2 = ty2 + Math.sin(model.angle + Math.PI) * model.BEAM_LENGTH;
            this._drawBeam(tx2, ty2, bx2, by2, currentHalfW, alpha);
        }
    }

    _drawBeam(x1, y1, x2, y2, halfW, alpha) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return;

        // Perpendicular vector (normalized)
        const px = -dy / len;
        const py = dx / len;

        // Draw glow (wider, more transparent)
        this._glowGraphics.setVisible(true);
        this._glowGraphics.clear();
        this._glowGraphics.fillStyle(0x00ffff, 0.2 * alpha);
        this._glowGraphics.fillPoints([
            { x: x1 + px * halfW * 2, y: y1 + py * halfW * 2 },
            { x: x2 + px * halfW * 2, y: y2 + py * halfW * 2 },
            { x: x2 - px * halfW * 2, y: y2 - py * halfW * 2 },
            { x: x1 - px * halfW * 2, y: y1 - py * halfW * 2 },
        ], true);

        // Draw main beam (core white center)
        this._beamGraphics.setVisible(true);
        this._beamGraphics.clear();

        // Outer color layer
        this._beamGraphics.fillStyle(0x00ffff, 0.7 * alpha);
        this._beamGraphics.fillPoints([
            { x: x1 + px * halfW, y: y1 + py * halfW },
            { x: x2 + px * halfW, y: y2 + py * halfW },
            { x: x2 - px * halfW, y: y2 - py * halfW },
            { x: x1 - px * halfW, y: y1 - py * halfW },
        ], true);

        // Inner bright core
        const coreW = halfW * 0.4;
        this._beamGraphics.fillStyle(0xe0ffff, 1.0 * alpha);
        this._beamGraphics.fillPoints([
            { x: x1 + px * coreW, y: y1 + py * coreW },
            { x: x2 + px * coreW, y: y2 + py * coreW },
            { x: x2 - px * coreW, y: y2 - py * coreW },
            { x: x1 - px * coreW, y: y1 - py * coreW },
        ], true);
    }
}

// ── Controller ────────────────────────────────────────────────────────────────

const laserAttack = (() => {
    const model = new LaserAttackModel();
    const view = new LaserAttackView();
    const _hitBuffer = [];

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
        } else {
            model.active = false;
            model.firing = false;
            view.hide();
            if (model.unlocked) view.show(model); // keep turret visible but beam off
        }
    }

    function _update(delta) {
        if (!model.unlocked) return;
        if (!tower.isAlive()) {
            view.hide();
            return;
        }

        const towerPos = tower.getPosition();

        // Always orbit
        if (!model.paused) {
            model.angle += model.ORBIT_SPEED * (delta / 1000);
        }

        view.update(model, towerPos.x, towerPos.y);

        if (!model.active || model.paused) return;

        if (model.firing) {
            model.fireTimer += delta;
            model.tickTimer += delta;

            // Damage tick
            while (model.tickTimer >= model.TICK_INTERVAL) {
                model.tickTimer -= model.TICK_INTERVAL;
                _dealDamage(towerPos);
            }

            // End firing phase
            if (model.fireTimer >= model.getFireDuration()) {
                model.firing = false;
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
            const ex = e.x - ox;
            const ey = e.y - oy;

            // t = dot(E, D) clamped to [1, L]
            const t = Math.max(0, Math.min(L, ex * cos + ey * sin));

            // Closest point on beam segment
            const cpx = ox + cos * t;
            const cpy = oy + sin * t;

            // Optimization 2: Squared distance comparison (avoids expensive Math.sqrt)
            const dx = e.x - cpx;
            const dy = e.y - cpy;
            const reach = halfDmgW + (e.size || 0);

            if ((dx * dx + dy * dy) < (reach * reach)) {
                enemyManager.damageEnemy(e, dmg);

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
