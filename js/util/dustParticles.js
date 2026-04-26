/**
 * dustParticles.js — Ambient floating square dust effect.
 *
 * Two-emitter setup for performance:
 *   Emitter A: Small tight/hollow squares — ~50 particles, 1 draw call
 *   Emitter B: Large blurry blobs — ~8 particles, 1 draw call
 *
 * Both emitters use the 'ui' atlas for texture batching.
 * Depth: DEPTH_TOWER (200) < DUST_DEPTH (300) < DEPTH_HUD (1000)
 *
 * Particle lifecycle per particle:
 *   [0–25% lifespan] Scale in: 0 → targetScale  (Quad.easeOut)
 *   [25–70% lifespan] Hold at targetScale, full alpha
 *   [70–100% lifespan] Fade out: maxAlpha → 0
 *
 * Usage:
 *   dustParticles.start(scene);
 *   dustParticles.stop();
 */
const dustParticles = (() => {
    const DUST_DEPTH = GAME_CONSTANTS.DEPTH_ENEMIES - 10;

    let _emitterSmall = null;
    let _emitterBig = null;

    // ── EmitterOp helpers ────────────────────────────────────────────────────
    // In Phaser 3, onUpdate receives t = lifeCurrent/lifespan (1→0 as particle ages).
    // lifeProgress = 1 - t = 0→1 over particle lifespan.

    const _scaleOpsSmall = {
        onEmit: (particle) => {
            // Store a unique target scale per particle
            particle.data.targetScale = Phaser.Math.FloatBetween(0.64, 1.15);
            particle.data.targetScale *= particle.data.targetScale * particle.data.targetScale;
            if (particle.data.targetScale < 0.3) {
                particle.data.targetScale = 0.3;
            }
            return 0; // Start at scale 0
        },
        onUpdate: (particle, key, t) => {
            const lifeProgress = 1 - t; // 0 (new) → 1 (dying)
            if (lifeProgress < 0.40) {
                // Scale in during first 40% of life
                return Phaser.Math.Easing.Quadratic.Out(lifeProgress / 0.40) * particle.data.targetScale;
            }
            return particle.data.targetScale;
        }
    };

    const _alphaOpsSmall = {
        onEmit: (particle) => {
            particle.data.maxAlpha = Phaser.Math.FloatBetween(0.06, 0.1);
            return particle.data.maxAlpha;
        },
        onUpdate: (particle, key, t) => {
            // t: 1 (new) → 0 (dying). Fade out in last 30% of life (t < 0.3)
            if (t < 0.3) {
                return (t / 0.3) * particle.data.maxAlpha;
            }
            return particle.data.maxAlpha;
        }
    };

    const _scaleOpsBig = {
        onEmit: (particle) => {
            particle.data.targetScale = Phaser.Math.FloatBetween(1.25, 3);
            return 0;
        },
        onUpdate: (particle, key, t) => {
            const lifeProgress = 1 - t;
            if (lifeProgress < 0.40) {
                // Scale in during first 40% of life
                return Phaser.Math.Easing.Quadratic.Out(lifeProgress / 0.40) * particle.data.targetScale;
            }
            return particle.data.targetScale;
        }
    };

    const _alphaOpsBig = {
        onEmit: (particle) => {
            particle.data.maxAlpha = Phaser.Math.FloatBetween(0.04, 0.09);
            return particle.data.maxAlpha;
        },
        onUpdate: (particle, key, t) => {
            if (t < 0.3) {
                return (t / 0.3) * particle.data.maxAlpha;
            }
            return particle.data.maxAlpha;
        }
    };

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Start the ambient dust particle effect.
     * @param {Phaser.Scene} scene
     */
    function start(scene) {
        if (_emitterSmall) return; // Already running

        const W = GAME_CONSTANTS.WIDTH;
        const H = GAME_CONSTANTS.HEIGHT;

        // ── Emitter A: Small sharp + hollow squares ───────────────────────────
        _emitterSmall = scene.add.particles(0, 0, 'ui', {
            frame: ['particle_square.png', 'particle_square_hollow.png', 'particle_square_blur.png'],
            x: { min: 0, max: W },
            y: { min: 0, max: H },
            speedX: { min: -10, max: 10 },
            speedY: { min: -10, max: 10 },
            scale: _scaleOpsSmall,
            alpha: _alphaOpsSmall,
            lifespan: { min: 4000, max: 9000 },
            frequency: 60,
            maxParticles: 0,
            rotate: { min: 0, max: 360 },
            gravityY: 0,
            blendMode: Phaser.BlendModes.NORMAL,
        }).setDepth(DUST_DEPTH).setScrollFactor(0.6);

        // ── Emitter B: Large blurry blob squares ─────────────────────────────
        _emitterBig = scene.add.particles(0, 0, 'ui', {
            frame: 'particle_square_blur_big.png',
            x: { min: 0, max: W },
            y: { min: 0, max: H },
            speedX: { min: -6, max: 6 },
            speedY: { min: -15, max: -4 },
            scale: _scaleOpsBig,
            alpha: _alphaOpsBig,
            lifespan: { min: 7000, max: 14000 },
            frequency: 600,
            maxParticles: 0,
            gravityY: 0,
            blendMode: Phaser.BlendModes.NORMAL,
        }).setDepth(DUST_DEPTH - 1).setScrollFactor(0.4);
    }

    /**
     * Stop and destroy all dust particle emitters.
     */
    function stop() {
        if (_emitterSmall) {
            _emitterSmall.destroy();
            _emitterSmall = null;
        }
        if (_emitterBig) {
            _emitterBig.destroy();
            _emitterBig = null;
        }
    }

    /** Whether the effect is currently running. */
    function isActive() {
        return _emitterSmall !== null;
    }

    return { start, stop, isActive };
})();
