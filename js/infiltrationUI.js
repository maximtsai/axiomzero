/**
 * @fileoverview Helpers for the Financial Breach terminal (takeoverPopup.js).
 *
 * Every terminal visual is baked into the 'infiltration' atlas: exported from
 * mockups/infiltration-terminal.html by tools/export-terminal-assets.js and packed with
 * raw/infiltration.tps. Each colour variant is its own frame, so there is no runtime
 * tinting and the terminal works on the canvas renderer.
 *
 * This file only holds the shared palette/fonts, a text factory, the baked-image button
 * (with optional hold-to-confirm), a glitch accent for text, and intrusion-log lines.
 */
const infiltrationUI = (() => {
    const ATLAS = 'infiltration';

    const COLOR = {
        TEXT: '#e6f3ff',
        MUTED: '#8899aa',
        DIM: '#4f6072',
        CYAN: '#00f5ff',
        RED: '#ff5555',
        GREEN: '#44ff44',
        LOG: '#5fd4e0',
        WHITE: '#ffffff',
    };

    const FONT = {
        BOLD: 'Quantico-Bold',
        REG: 'Quantico-Regular',
        ITALIC: 'Quantico-Italic',
    };

    /** Atlas-frame suffix and text colour per security level. */
    const SECURITY = {
        LOW: { key: 'low', color: '#44ff44', swatch: 'px_green.png' },
        MEDIUM: { key: 'medium', color: '#ffcc00', swatch: 'px_medium.png' },
        HIGH: { key: 'high', color: '#ff4444', swatch: 'px_high.png' },
    };

    const frame = (name) => name + '.png';

    // ── Text ─────────────────────────────────────────────────────────────────

    /**
     * Create a text object. opts: { size, font, color, origin: [x, y], spacing, wrap, align }
     */
    function text(scene, x, y, str, opts = {}) {
        const t = scene.add.text(x, y, str, {
            fontFamily: opts.font || FONT.REG,
            fontSize: (opts.size || 14) + 'px',
            color: opts.color || COLOR.TEXT,
            align: opts.align || 'left',
            wordWrap: opts.wrap ? { width: opts.wrap } : undefined,
        });
        const o = opts.origin || [0, 0.5];
        t.setOrigin(o[0], o[1]);
        if (opts.spacing) t.setLetterSpacing(opts.spacing);
        return t;
    }

    /** Brief RGB-split glitch on a text object (two coloured copies that jitter, then vanish). */
    function glitchText(scene, add, target) {
        if (!target || !target.active) return;
        const ghosts = [['#ff0050', -3], [COLOR.CYAN, 3]].map(([color, dx]) => {
            const g = add(scene.add.text(target.x + dx, target.y, target.text, target.style).setOrigin(target.originX, target.originY));
            g.setLetterSpacing(target.letterSpacing || 0);
            g.setColor(color).setAlpha(0.75).setDepth(target.depth + 0.01);
            helper.setBlendMode(g, Phaser.BlendModes.ADD);
            return g;
        });
        const steps = [[2, -2], [-3, 3], [1, -1], [3, -3]];
        steps.forEach(([a, b], i) => scene.time.delayedCall(i * 90, () => {
            if (ghosts[0].active) ghosts[0].x = target.x + a;
            if (ghosts[1].active) ghosts[1].x = target.x + b;
        }));
        scene.time.delayedCall(380, () => ghosts.forEach(g => g.active && g.destroy()));
    }

    // ── Baked button ─────────────────────────────────────────────────────────

    /**
     * Button built from baked frames `${base}_normal/_hover/_press` with a live label and sub-label.
     * cfg: { x, y (centre), w, h (hit area), base, depth, label, sub, labelColor,
     *        enabled, deniedFrame, chevron (frame), glowFrame, holdFrame + holdMs (hold-to-confirm),
     *        onClick, onDenied }
     * Returns { objects, setLabel, setEnabled, shake, pulse, tick } — call tick() every frame
     * for hold-to-confirm buttons.
     */
    function button(scene, add, cfg) {
        const { x, y, w, h, depth } = cfg;
        let enabled = cfg.enabled !== false;
        let hover = false;
        let pressed = false;
        let holdStart = 0;

        const glow = cfg.glowFrame ? add(scene.add.image(x, y, ATLAS, frame(cfg.glowFrame)).setDepth(depth - 0.01).setAlpha(0)) : null;
        const bg = add(scene.add.image(x, y, ATLAS, frame(cfg.base + '_normal')).setDepth(depth));
        const fill = cfg.holdFrame ? add(scene.add.image(x, y, ATLAS, frame(cfg.holdFrame)).setDepth(depth + 0.05)) : null;
        const chev = cfg.chevron ? add(scene.add.image(x + w / 2 - 37.5, y, ATLAS, frame(cfg.chevron)).setDepth(depth + 0.1)) : null;
        const label = add(text(scene, x, y - 10.5, cfg.label, { font: FONT.BOLD, size: 19, origin: [0.5, 0.5], spacing: 3 }).setDepth(depth + 0.1));
        const sub = add(text(scene, x, y + 15.5, cfg.sub || '', { size: 12, origin: [0.5, 0.5], spacing: 1, color: COLOR.MUTED }).setDepth(depth + 0.1));
        const zone = add(scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }).setDepth(depth + 0.2));
        const fw = bg.frame.width;
        const pad = (fw - w) / 2;

        if (chev) scene.tweens.add({ targets: chev, alpha: 0.3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        function setHold(k) {
            if (fill) fill.setCrop(0, 0, k > 0 ? pad + w * k : 0, fill.frame.height);
        }
        setHold(0);

        function draw() {
            if (!enabled) {
                bg.setFrame(frame(cfg.deniedFrame || cfg.base + '_normal'));
                label.setColor(COLOR.MUTED);
                if (chev) chev.setVisible(false);
                return;
            }
            bg.setFrame(frame(cfg.base + (pressed ? '_press' : hover ? '_hover' : '_normal')));
            label.setColor(hover ? COLOR.WHITE : cfg.labelColor);
            if (chev) chev.setVisible(true);
        }

        zone.on('pointerover', () => {
            hover = true;
            if (enabled) audio.play('click', 0.3);
            draw();
        });
        zone.on('pointerout', () => {
            hover = pressed = false;
            holdStart = 0;
            setHold(0);
            draw();
        });
        zone.on('pointerdown', () => {
            pressed = true;
            if (enabled && cfg.holdFrame) holdStart = performance.now();
            draw();
        });
        zone.on('pointerup', () => {
            const wasPressed = pressed;
            pressed = false;
            draw();
            if (cfg.holdFrame) {
                holdStart = 0;
                setHold(0);
                return; // hold buttons only fire from tick()
            }
            if (!wasPressed) return;
            if (enabled) { if (cfg.onClick) cfg.onClick(); } else if (cfg.onDenied) cfg.onDenied();
        });
        draw();

        const visuals = [glow, bg, fill, chev, label, sub].filter(Boolean);
        return {
            objects: [...visuals, zone],
            setLabel(l, s) {
                label.setText(l);
                if (s !== undefined) sub.setText(s);
            },
            setEnabled(v) { enabled = v; draw(); },
            shake() {
                visuals.forEach(o => {
                    scene.tweens.killTweensOf(o);
                    const x0 = o.x;
                    scene.tweens.add({ targets: o, x: x0 + 7, duration: 45, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', onComplete: () => o.setX(x0) });
                });
                if (chev) scene.tweens.add({ targets: chev, alpha: 0.3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 300 });
            },
            /** Breathing glow behind the button (e.g. CLAIM). */
            pulse() {
                if (glow) scene.tweens.add({ targets: glow, alpha: { from: 0, to: 1 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            },
            /** Advance hold-to-confirm; fires onClick when the hold completes. */
            tick() {
                if (!holdStart) return;
                const k = Math.min(1, (performance.now() - holdStart) / (cfg.holdMs || 800));
                setHold(k);
                if (k >= 1) {
                    holdStart = 0;
                    pressed = false;
                    setHold(0);
                    if (cfg.onClick) cfg.onClick();
                }
            },
        };
    }

    // ── Procedural flavour ───────────────────────────────────────────────────

    /** Deterministic 32-bit hash of a string (FNV-1a). */
    function hashString(str) {
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return h >>> 0;
    }

    /** Proxy hops drawn on a target's route (stable per target). */
    function routeHops(target) {
        const base = { LOW: 3, MEDIUM: 5, HIGH: 8 }[target.security] || 3;
        return Math.min(5, Math.ceil((base + hashString(target.name + target.security) % 3) / 2));
    }

    const _hex = (n) => Math.floor(Math.random() * 16 ** n).toString(16).toUpperCase().padStart(n, '0');
    const _ip = () => `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;

    const LOG_TEMPLATES = [
        () => t('takeover', 'log_proxy', [_ip()]),
        () => t('takeover', 'log_token', ['0x' + _hex(8)]),
        () => t('takeover', 'log_payload', [String(Math.floor(Math.random() * 900) + 64)]),
        () => t('takeover', 'log_keyspace', ['0x' + _hex(6)]),
        () => t('takeover', 'log_relays', [String(Math.floor(Math.random() * 9) + 3)]),
        () => t('takeover', 'log_ledger', ['#' + _hex(5)]),
        () => t('takeover', 'log_ids', [String(Math.floor(Math.random() * 40) + 2)]),
        () => t('takeover', 'log_mirror', [_ip()]),
    ];

    /** A random generic intrusion-log line. */
    function randomLogLine() {
        return LOG_TEMPLATES[Math.floor(Math.random() * LOG_TEMPLATES.length)]();
    }

    return {
        ATLAS, COLOR, FONT, SECURITY, frame,
        text, glitchText, button,
        routeHops, randomLogLine,
    };
})();
