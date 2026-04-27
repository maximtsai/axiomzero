// Hijack.js — Hijacking logic for homing missiles
/**
 * Hijack Projectile
 * 
 * BEHAVIOR:
 * - Homing: Targets and tracks enemies automatically.
 * - Movement: Features a "wriggling" snake-like pathing algorithm (sine-wave oscillation).
 * - Impact: Creates a small damaging AoE (Area of Effect) explosion on contact or lifetime expiry.
 * - Recursion: If the "Recursion" upgrade is researched, destroying an enemy with this projectile 
 *   can spawn additional Hijack projectiles from the impact site.
 */

const hijackManager = (() => {
    const POOL_SIZE = 100;
    const HIJACK_SPEED = GAME_CONSTANTS.PROJECTILE_SPEED * 0.35;
    const AOE_RADIUS = 90;
    const RECHECK_INTERVAL = 333; // 1/3 second
    const DETECTION_OFFSET = 150;
    const DETECTION_RADIUS = 150;
    const RAPID_RECHECK_RADIUS_SQ = 120 * 120;

    let pool = [];
    let activeHijacks = [];
    let overflowCount = 0;
    let paused = false;

    function init() {
        pool = new ObjectPool(
            () => new Hijack(),
            (h) => h.deactivate(),
            POOL_SIZE
        ).preAllocate(25);

        messageBus.subscribe('gamePaused', () => { paused = true; });
        messageBus.subscribe('gameResumed', () => { paused = false; });
        messageBus.subscribe('phaseChanged', (phase) => {
            if (phase !== GAME_CONSTANTS.PHASE_COMBAT) {
                clearAll();
            }
        });

        messageBus.subscribe('enemyKilled', (data) => {
            const hijackLevel = (gameState.upgrades && gameState.upgrades.hijack) || 0;
            if (hijackLevel > 0 && data.wasResonance && !data.isBoss) {
                // Resonance kill: Spawn missiles based on hijacksSpawned
                const config = getCurrentLevelConfig();
                const currentScale = (GAME_VARS.scaleFactor || 1) * (config.levelScalingModifier || 1);
                const basicEnemyHealth = GAME_CONSTANTS.ENEMY_BASE_HEALTH * currentScale;
                const dmg = basicEnemyHealth;
                const lifetime = 2500 + Math.random() * 750;

                // For resonance, we spawn missiles based on the enemy's hijacksSpawned property (with overflow accumulation)
                const baseSpawn = data.hijacksSpawned || 0;
                const total = baseSpawn + overflowCount;
                const count = Math.floor(total);
                overflowCount = total - count;

                for (let i = 0; i < count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    spawn(data.x, data.y, dmg, angle, lifetime);
                }
            }
        });

        updateManager.addFunction(_update);
    }

    function spawn(x, y, damage, rotation, lifetime) {
        if (!pool) return;
        const h = pool.get();
        if (!h) return;

        h.activate(x, y, damage, rotation, lifetime);
        activeHijacks.push(h);
        return h;
    }

    function handleRecursion(enemy, x, y, damage, lifetime) {
        if (enemy.model.isBoss) return;

        const recursionLevel = (gameState.upgrades && gameState.upgrades.recursion) || 0;
        if (recursionLevel <= 0) return;

        let spawnCount = 0;
        const baseSpawn = enemy.model.hijacksSpawned || 0;
        const total = baseSpawn + overflowCount;
        spawnCount = Math.floor(total);
        overflowCount = total - spawnCount;

        const config = getCurrentLevelConfig();
        const currentScale = (GAME_VARS.scaleFactor || 1) * (config.levelScalingModifier || 1);
        const basicEnemyHealth = GAME_CONSTANTS.ENEMY_BASE_HEALTH * currentScale;
        for (let i = 0; i < spawnCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            spawn(x, y, basicEnemyHealth, angle, lifetime);
        }
    }

    function clearAll() {
        for (let i = activeHijacks.length - 1; i >= 0; i--) {
            pool.release(activeHijacks[i]);
        }
        activeHijacks.length = 0;
        overflowCount = 0;
    }

    function _update(delta) {
        if (paused || activeHijacks.length === 0) return;

        const dt = delta / 1000;
        for (let i = activeHijacks.length - 1; i >= 0; i--) {
            const h = activeHijacks[i];
            if (!h.active) {
                activeHijacks.splice(i, 1);
                pool.release(h);
                continue;
            }

            h.update(delta);

            if (!h.active) {
                activeHijacks.splice(i, 1);
                pool.release(h);
            }
        }
    }

    return { init, spawn, handleRecursion, clearAll, HIJACK_SPEED, AOE_RADIUS, DETECTION_OFFSET, DETECTION_RADIUS, RECHECK_INTERVAL, RAPID_RECHECK_RADIUS_SQ };
})();

class Hijack {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.damage = 0;
        this.rotation = 0; // Model rotation
        this.visualRotation = 0;
        this.lifetime = 0;
        this.active = false;
        this.target = null;
        this.recheckTimer = 0;
        this.wavyRotationForce = 0;
        this.wavySign = 0; // 1 or -1

        this.img = PhaserScene.add.image(0, 0, 'enemies', 'projectile_hijack.png');
        this.img.setDepth(GAME_CONSTANTS.DEPTH_PROJECTILES);
        this.img.setVisible(false);
        this.img.setActive(false);

        this._queryResults = [];
    }

    activate(x, y, damage, rotation, lifetime) {
        this.x = x;
        this.y = y;
        this.damage = damage;
        this.rotation = rotation;
        this.visualRotation = rotation;
        this.lifetime = lifetime;
        this.active = true;
        this.target = null;
        this.recheckTimer = 0;
        this.wavySign = Math.random() < 0.5 ? 1 : -1;
        this.wavyRotationForce = 0; // Will be set in first recheck
        this.isRapidChecking = false;

        this.img.setPosition(x, y);
        this.img.setRotation(rotation);
        this.img.setVisible(true);
        this.img.setActive(true);
        this.img.setScale(0.85);

        this.img.setScale(0.8);

        this._recheck(0);
    }

    deactivate() {
        this.active = false;
        this.img.setVisible(false);
        this.img.setActive(false);
        this.img.setActive(false);
        this.target = null;
    }

    update(delta) {
        if (!this.active) return;

        const dt = delta / 1000;
        this.lifetime -= delta;

        if (this.lifetime <= 0) {
            this.explode();
            return;
        }

        // Movement
        // Scale rotation by dt (normalized to 60fps) to keep turning consistent across different framerates
        this.rotation += this.wavyRotationForce * (dt * 60);
        this.x += Math.cos(this.rotation) * hijackManager.HIJACK_SPEED * dt;
        this.y += Math.sin(this.rotation) * hijackManager.HIJACK_SPEED * dt;

        // Visual rotation follows model with a slight lag or smoothing?
        // User requested subtle constantly nudged, so I'll just sync for now
        this.visualRotation = this.rotation;

        this.img.setPosition(this.x, this.y);
        this.img.setRotation(this.visualRotation);
        this.img.setRotation(this.visualRotation);

        // Recheck logic
        const threshold = this.isRapidChecking ? hijackManager.RECHECK_INTERVAL / 2 : hijackManager.RECHECK_INTERVAL;
        this.recheckTimer += delta;
        if (this.recheckTimer >= threshold) {
            this._recheck(this.recheckTimer);
            this.recheckTimer = 0;
        }

        // Collision check
        this._queryResults.length = 0;
        enemyManager.getEnemiesInSquareRange(this.x, this.y, 40, this._queryResults);
        for (const e of this._queryResults) {
            if (e.model.alive && e.checkCollision(this.x, this.y, 1.0, 0, 15)) {
                this.explode(e);
                return;
            }
        }
    }

    _recheck(dt) {
        // 1. Confirm target
        let needsNewTarget = false;
        if (!this.target || !this.target.model || !this.target.model.alive || !this.target.model.isTargeted) {
            needsNewTarget = true;
        }

        if (needsNewTarget) {
            const centerX = this.x + Math.cos(this.rotation) * hijackManager.DETECTION_OFFSET;
            const centerY = this.y + Math.sin(this.rotation) * hijackManager.DETECTION_OFFSET;

            this._queryResults.length = 0;
            enemyManager.getEnemiesInSquareRange(centerX, centerY, hijackManager.DETECTION_RADIUS, this._queryResults);

            let bestScore = -Infinity;
            let bestEnemy = null;

            for (const e of this._queryResults) {
                if (!e.model.alive) continue;
                const dx = e.model.x - centerX;
                const dy = e.model.y - centerY;
                const dist2 = dx * dx + dy * dy;
                if (dist2 > hijackManager.DETECTION_RADIUS * hijackManager.DETECTION_RADIUS) continue;

                const dist = Math.sqrt(dist2);
                const score = (e.model.targetAttractiveness || 0) - dist;
                if (score > bestScore) {
                    bestScore = score;
                    bestEnemy = e;
                }
            }

            if (bestEnemy) {
                if (this.target && this.target.model) this.target.model.isTargeted = false;
                this.target = bestEnemy;
                this.target.model.targetAttractiveness -= 30;
                this.target.model.isTargeted = true;
            }
        }

        // 2. Update Wavy Force
        // this.wavySign *= -1; // Flip sign (Disabled for homing test)

        if (this.target) {
            const angleToTarget = Math.atan2(this.target.model.y - this.y, this.target.model.x - this.x);
            const diff = Phaser.Math.Angle.ShortestBetween(this.rotation, angleToTarget);

            // Homing test: consistently rotate toward target using max wavy force
            this.wavyRotationForce = diff > 0 ? 0.07 : -0.07;
        } else {
            // No target, just slight drift
            this.wavySign *= -1;
            this.wavyRotationForce = this.wavySign * 0.025;
        }

        // 3. Rapid Check State
        this.isRapidChecking = false;
        if (this.target && this.target.model && this.target.model.alive) {
            const dx = this.target.model.x - this.x;
            const dy = this.target.model.y - this.y;
            if (dx * dx + dy * dy < hijackManager.RAPID_RECHECK_RADIUS_SQ) {
                this.isRapidChecking = true;
            }
        }
    }

    explode(directHitEnemy = null) {
        const ex = this.x;
        const ey = this.y;

        // Visuals
        const explosion = PhaserScene.add.sprite(ex, ey, 'enemies', 'explosion_anim0.png');
        explosion.setDepth(GAME_CONSTANTS.DEPTH_PROJECTILES + 10);
        explosion.setScale(1.0);
        explosion.play('explosion_anim');
        explosion.on('animationcomplete', () => explosion.destroy());

        // Damage AOE
        this._queryResults.length = 0;
        enemyManager.getEnemiesInSquareRange(ex, ey, hijackManager.AOE_RADIUS, this._queryResults);

        const r2 = hijackManager.AOE_RADIUS * hijackManager.AOE_RADIUS;
        for (const e of this._queryResults) {
            if (!e.model.alive) continue;
            const dx = e.model.x - ex;
            const dy = e.model.y - ey;
            if (dx * dx + dy * dy <= r2) {
                const wasAlive = e.model.alive;
                enemyManager.damageEnemy(e, this.damage, 'hijack');

                // Recursion check: if it died from this damage
                if (wasAlive && !e.model.alive) {
                    const newLifetime = 1750 + Math.random() * 750;
                    hijackManager.handleRecursion(e, e.model.x, e.model.y, this.damage, newLifetime);
                }
            }
        }

        this.deactivate();
    }
}
