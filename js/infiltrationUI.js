/**
 * @fileoverview Vector UI kit for the Financial Breach terminal (takeoverPopup.js).
 * Everything is flat, depth-sorted Phaser objects: single-colour vector lines on
 * near-black, glow faked with layered low-alpha strokes (no FX pipeline, no Containers).
 *
 * Components register every object they create through an `add(obj)` callback so the
 * popup can track, camera-assign and destroy them per layer.
 */
const infiltrationUI = (() => {

    // ── Theme ────────────────────────────────────────────────────────────────

    const THEME = {
        BG: 0x05080f,
        ROW: 0x0a111c,
        LINE: 0x1e2c3c,
        CYAN: 0x00f5ff,
        RED: 0xff5555,
        GREEN: 0x44ff44,
        DISABLED: 0x445566,
        TEXT: '#e6f3ff',
        MUTED: '#8899aa',
        DIM: '#4f6072',
        CYAN_STR: '#00f5ff',
        RED_STR: '#ff5555',
        GREEN_STR: '#44ff44',
    };

    const FONT = {
        BOLD: 'Quantico-Bold',
        REG: 'Quantico-Regular',
        ITALIC: 'Quantico-Italic',
    };

    const toHex = (str) => Phaser.Display.Color.HexStringToColor(str).color;

    // ── Shape primitives ─────────────────────────────────────────────────────

    /** Polygon points for a rect (top-left x,y) with chamfered top-right and bottom-left corners. */
    function chamferPoints(x, y, w, h, cut = 12) {
        return [
            { x: x, y: y },
            { x: x + w - cut, y: y },
            { x: x + w, y: y + cut },
            { x: x + w, y: y + h },
            { x: x + cut, y: y + h },
            { x: x, y: y + h - cut },
        ];
    }

    function _path(g, pts) {
        g.beginPath();
        g.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
        g.closePath();
    }

    function fillChamfer(g, x, y, w, h, cut, color, alpha) {
        g.fillStyle(color, alpha);
        _path(g, chamferPoints(x, y, w, h, cut));
        g.fillPath();
    }

    function strokeChamfer(g, x, y, w, h, cut, color, alpha, width = 1.5) {
        g.lineStyle(width, color, alpha);
        _path(g, chamferPoints(x, y, w, h, cut));
        g.strokePath();
    }

    /** Stroke with a soft outer glow: two wide, faint passes under the main line. */
    function glowChamfer(g, x, y, w, h, cut, color, alpha = 1, strength = 1) {
        strokeChamfer(g, x, y, w, h, cut, color, 0.07 * strength * alpha, 9);
        strokeChamfer(g, x, y, w, h, cut, color, 0.16 * strength * alpha, 4);
        strokeChamfer(g, x, y, w, h, cut, color, alpha, 1.5);
    }

    /** HUD-style corner brackets around a rect. */
    function brackets(g, x, y, w, h, len, color, alpha = 1, width = 2) {
        g.lineStyle(width, color, alpha);
        const segs = [
            [x, y + len, x, y, x + len, y],
            [x + w - len, y, x + w, y, x + w, y + len],
            [x + w, y + h - len, x + w, y + h, x + w - len, y + h],
            [x + len, y + h, x, y + h, x, y + h - len],
        ];
        for (const s of segs) {
            g.beginPath();
            g.moveTo(s[0], s[1]);
            g.lineTo(s[2], s[3]);
            g.lineTo(s[4], s[5]);
            g.strokePath();
        }
    }

    /** Dashed rect outline (for empty/offline slots). */
    function dashedRect(g, x, y, w, h, color, alpha, dash = 8, gap = 6) {
        g.lineStyle(1, color, alpha);
        const edge = (x1, y1, x2, y2) => {
            const len = Math.hypot(x2 - x1, y2 - y1);
            const dx = (x2 - x1) / len, dy = (y2 - y1) / len;
            for (let d = 0; d < len; d += dash + gap) {
                const e = Math.min(d + dash, len);
                g.lineBetween(x1 + dx * d, y1 + dy * d, x1 + dx * e, y1 + dy * e);
            }
        };
        edge(x, y, x + w, y);
        edge(x + w, y, x + w, y + h);
        edge(x + w, y + h, x, y + h);
        edge(x, y + h, x, y);
    }

    /** Security rating pips: `filled` of `total` slanted bars starting at x,y (vertical centre). */
    function pips(g, x, y, filled, total, color) {
        for (let i = 0; i < total; i++) {
            const px = x + i * 12;
            const on = i < filled;
            g.fillStyle(on ? color : THEME.DISABLED, on ? 1 : 0.5);
            g.beginPath();
            g.moveTo(px + 3, y - 6);
            g.lineTo(px + 9, y - 6);
            g.lineTo(px + 6, y + 6);
            g.lineTo(px, y + 6);
            g.closePath();
            g.fillPath();
        }
    }

    /** Faint CRT scanlines over a rect. */
    function scanlines(g, x, y, w, h, alpha = 0.035, spacing = 4) {
        g.lineStyle(1, 0xffffff, alpha);
        for (let ly = y; ly < y + h; ly += spacing) g.lineBetween(x, ly, x + w, ly);
    }

    /** Small right-pointing chevrons (used on primary buttons). */
    function chevrons(g, x, y, color, alpha, count = 2) {
        g.lineStyle(2, color, alpha);
        for (let i = 0; i < count; i++) {
            const cx = x + i * 9;
            g.beginPath();
            g.moveTo(cx, y - 6);
            g.lineTo(cx + 6, y);
            g.lineTo(cx, y + 6);
            g.strokePath();
        }
    }

    /** Hexagonal reward icon with a glyph for the reward type. */
    function hexIcon(g, x, y, r, rewardType, color) {
        const pts = [];
        for (let i = 0; i < 6; i++) {
            const a = Phaser.Math.DegToRad(-90 + i * 60);
            pts.push({ x: x + r * Math.cos(a), y: y + r * Math.sin(a) });
        }
        g.fillStyle(color, 0.1);
        _path(g, pts);
        g.fillPath();
        g.lineStyle(5, color, 0.12);
        _path(g, pts);
        g.strokePath();
        g.lineStyle(1.5, color, 0.9);
        _path(g, pts);
        g.strokePath();

        const s = r / 24;
        const line = (x1, y1, x2, y2) => g.lineBetween(x + x1 * s, y + y1 * s, x + x2 * s, y + y2 * s);
        g.lineStyle(1.5, color, 0.95);
        if (rewardType === 'coin') {
            // Bank column building
            line(-12, 10, 12, 10);
            line(-14, -2, 14, -2);
            line(-14, -2, 0, -12);
            line(0, -12, 14, -2);
            line(-7, -2, -7, 10);
            line(0, -2, 0, 10);
            line(7, -2, 7, 10);
        } else if (rewardType === 'data') {
            // Server racks
            g.strokeRect(x - 11 * s, y - 10 * s, 9 * s, 21 * s);
            g.strokeRect(x + 2 * s, y - 6 * s, 9 * s, 17 * s);
            for (const ly of [-5, 0, 5]) line(-9, ly, -4, ly);
            for (const ly of [-2, 3, 8]) line(4, ly, 9, ly);
        } else {
            // Neural circuit
            line(0, -12, 0, 12);
            for (const sx of [-1, 1]) {
                line(0, -6, 7 * sx, -10);
                line(7 * sx, -10, 12 * sx, -10);
                line(0, 0, 10 * sx, 0);
                line(0, 6, 7 * sx, 10);
                line(7 * sx, 10, 12 * sx, 10);
            }
            g.fillStyle(color, 1);
            for (const [px, py] of [[-12, -10], [-10, 0], [-12, 10], [12, -10], [10, 0], [12, 10]]) {
                g.fillCircle(x + px * s, y + py * s, 1.6);
            }
        }
    }

    // ── Text ─────────────────────────────────────────────────────────────────

    /**
     * Create a text object. opts: { size, font, color, origin: [x, y], spacing, wrap, align }
     */
    function text(scene, x, y, str, opts = {}) {
        const t = scene.add.text(x, y, str, {
            fontFamily: opts.font || FONT.REG,
            fontSize: (opts.size || 14) + 'px',
            color: opts.color || THEME.TEXT,
            align: opts.align || 'left',
            wordWrap: opts.wrap ? { width: opts.wrap } : undefined,
        });
        const o = opts.origin || [0, 0.5];
        t.setOrigin(o[0], o[1]);
        if (opts.spacing) t.setLetterSpacing(opts.spacing);
        return t;
    }

    // ── Button ───────────────────────────────────────────────────────────────

    /**
     * Vector button with glow, hover/press states, an optional sub-label and a disabled state.
     * cfg: { x, y (centre), w, h, label, sub, color, depth, enabled, chevrons, onClick, onDenied }
     * @returns {{ setEnabled, setLabel, shake, pulse, objects }}
     */
    function button(scene, add, cfg) {
        const { x, y, w, h, depth } = cfg;
        const left = x - w / 2, top = y - h / 2;
        let enabled = cfg.enabled !== false;
        let hover = false;

        const glow = add(scene.add.graphics().setDepth(depth));
        const g = add(scene.add.graphics().setDepth(depth + 0.1));
        const label = add(text(scene, x, cfg.sub ? y - 9 : y, cfg.label, { font: FONT.BOLD, size: cfg.size || 19, origin: [0.5, 0.5], spacing: 2 }).setDepth(depth + 0.2));
        const sub = cfg.sub !== undefined
            ? add(text(scene, x, y + 14, cfg.sub, { size: 12, origin: [0.5, 0.5], spacing: 1 }).setDepth(depth + 0.2))
            : null;
        const zone = add(scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }).setDepth(depth + 0.3));

        function draw(pressed = false) {
            glow.clear();
            g.clear();
            const color = enabled ? cfg.color : THEME.DISABLED;
            if (enabled) {
                strokeChamfer(glow, left, top, w, h, 12, color, hover ? 0.12 : 0.07, 10);
                strokeChamfer(glow, left, top, w, h, 12, color, hover ? 0.24 : 0.14, 4);
            }
            fillChamfer(g, left, top, w, h, 12, enabled ? color : 0x10151d, enabled ? (pressed ? 0.3 : hover ? 0.18 : 0.09) : 0.85);
            strokeChamfer(g, left, top, w, h, 12, color, enabled ? (hover ? 1 : 0.85) : 0.6, 1.5);
            if (cfg.chevrons && enabled) chevrons(g, left + w - 40, y, color, hover ? 1 : 0.7);
            const hex = '#' + color.toString(16).padStart(6, '0');
            label.setColor(enabled ? (hover ? '#ffffff' : hex) : THEME.MUTED);
            if (sub) sub.setColor(enabled ? THEME.MUTED : THEME.DIM);
        }

        zone.on('pointerover', () => {
            hover = true;
            if (enabled) audio.play('click', 0.3);
            draw();
        });
        zone.on('pointerout', () => { hover = false; draw(); });
        zone.on('pointerdown', () => draw(true));
        zone.on('pointerup', () => {
            draw();
            if (enabled) {
                if (cfg.onClick) cfg.onClick();
            } else if (cfg.onDenied) {
                cfg.onDenied();
            }
        });
        draw();

        const visuals = [glow, g, label, sub].filter(Boolean);
        return {
            objects: [...visuals, zone],
            setEnabled(v) { enabled = v; draw(); },
            setLabel(l, s) {
                label.setText(l);
                if (sub && s !== undefined) sub.setText(s);
            },
            shake() {
                visuals.forEach(o => {
                    scene.tweens.killTweensOf(o);
                    const x0 = o.x;
                    scene.tweens.add({ targets: o, x: x0 + 7, duration: 45, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', onComplete: () => o.setX(x0) });
                });
            },
            /** Breathing glow to draw the eye (e.g. CLAIM). */
            pulse() {
                scene.tweens.add({ targets: glow, alpha: { from: 1, to: 0.35 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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

    const CIPHERS = ['AES-256', 'RSA-4096', 'CHACHA20', 'ECC-P384', 'TWOFISH', 'SERPENT-256'];

    /** Stable fake network dossier for a target (same target → same values). */
    function dossier(target) {
        const h = hashString(target.name + target.security);
        const hops = { LOW: 3, MEDIUM: 5, HIGH: 8 }[target.security] || 3;
        return {
            host: `${10 + (h & 0x7f)}.${(h >>> 7) & 0xff}.${(h >>> 15) & 0xff}.${(h >>> 23) & 0xff}:${[443, 8443, 22, 3389, 5432][h % 5]}`,
            hops: hops + (h % 3),
            cipher: CIPHERS[(h >>> 3) % CIPHERS.length],
        };
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
        THEME, FONT, toHex,
        chamferPoints, fillChamfer, strokeChamfer, glowChamfer, brackets, dashedRect, pips, scanlines, chevrons, hexIcon,
        text, button,
        hashString, dossier, randomLogLine,
    };
})();
