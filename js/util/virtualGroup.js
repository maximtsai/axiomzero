/**
 * @fileoverview Virtual display-list grouping utility.
 * Manages a collection of Phaser GameObjects as a logical group
 * with shared positioning, alpha, and tween support.
 * Uses absolute offsets to prevent floating-point drift.
 * @module virtualGroup
 *
 * Usage:
 *   const g = createVirtualGroup(scene, x, y);
 *   g.add(sprite);          // track a child
 *   g.setPosition(100, 200); // move all children
 *   g.tweenTo(300, 400, { duration: 500 });
 *   g.destroy();            // destroy all children
 */
const createVirtualGroup = (scene, x = 0, y = 0) => {
    let children = [];
    let _x = x;
    let _y = y;
    let _scale = 1;
    let _active = true;
    let _scaleTween = null;

    /** Internal helper to sync children to current group state */
    const _syncChildren = () => {
        for (let i = 0, len = children.length; i < len; i++) {
            const c = children[i];
            const ref = c.ref;
            if (ref.scene) {
                ref.setScale(c.baseScaleX * _scale, c.baseScaleY * _scale);
                ref.setPosition(_x + c.offsetX * _scale, _y + c.offsetY * _scale);
            }
        }
    };

    const group = {
        activate: () => { _active = true; return group; },
        deactivate: () => { _active = false; return group; },
        isActive: () => _active,

        add: (gameObject) => {
            // Periodic cleanup: only filter if we reach a threshold to avoid excessive GC
            if (children.length > 50) {
                children = children.filter(c => c.ref && c.ref.scene);
            }

            children.push({
                ref: gameObject,
                offsetX: (gameObject.x - _x) / _scale,
                offsetY: (gameObject.y - _y) / _scale,
                baseScaleX: gameObject.scaleX / _scale,
                baseScaleY: gameObject.scaleY / _scale
            });
            return gameObject;
        },

        // Instant Alpha
        setAlpha: (value) => {
            for (let i = 0, len = children.length; i < len; i++) {
                const ref = children[i].ref;
                if (ref.scene) ref.alpha = value;
            }
            return group;
        },

        // Instant Scale
        setScale: (value) => {
            if (_scale === value) return group;
            _scale = value;
            _syncChildren();
            return group;
        },
        getScale: () => _scale,

        /**
         * tweenScale: Smoothly transition the group's scale over time.
         * Can optionally pivot around a specific screen coordinate (config.pivotX/Y).
         */
        tweenScale: (targetScale, config = {}) => {
            if (!_active) return;
            if (_scaleTween) {
                _scaleTween.stop();
                _scaleTween = null;
            }

            const startScale = _scale;
            const diffScale = targetScale - startScale;
            if (diffScale === 0) return group;

            const startX = _x;
            const startY = _y;
            const pivotX = (config.pivotX !== undefined) ? config.pivotX : _x;
            const pivotY = (config.pivotY !== undefined) ? config.pivotY : _y;

            _scaleTween = scene.tweens.add({
                targets: { progress: 0 },
                progress: 1,
                ...config,
                onUpdate: (tween, target) => {
                    _scale = startScale + (diffScale * target.progress);
                    _x = pivotX - ((pivotX - startX) / startScale) * _scale;
                    _y = pivotY - ((pivotY - startY) / startScale) * _scale;
                    _syncChildren();
                },
                onComplete: () => {
                    _scaleTween = null;
                    if (config.onComplete) config.onComplete();
                },
                onStop: () => {
                    _scaleTween = null;
                }
            });
            return group;
        },

        // Bulk Tween Alpha
        tweenAlpha: (targetAlpha, config = {}) => {
            const activeChildren = [];
            for (let i = 0, len = children.length; i < len; i++) {
                const ref = children[i].ref;
                if (ref.scene) activeChildren.push(ref);
            }
            
            if (activeChildren.length > 0) {
                scene.tweens.add({
                    targets: activeChildren,
                    alpha: targetAlpha,
                    ...config
                });
            }
        },

        // Standard Management
        removeChild: (gameObject) => {
            for (let i = 0; i < children.length; i++) {
                if (children[i].ref === gameObject) {
                    children.splice(i, 1);
                    return;
                }
            }
        },

        removeAllChildren: () => {
            children.length = 0;
        },

        destroy: () => {
            for (let i = 0, len = children.length; i < len; i++) {
                const ref = children[i].ref;
                if (ref && ref.destroy) ref.destroy();
            }
            children.length = 0;
        },

        // --- POSITIONING ENGINE (Absolute Offset Logic) ---

        set x(val) {
            if (!_active || _x === val) return;
            _x = val;
            for (let i = 0, len = children.length; i < len; i++) {
                const c = children[i];
                if (c.ref.scene) c.ref.setPosition(_x + c.offsetX * _scale, c.ref.y);
            }
        },
        get x() { return _x; },

        set y(val) {
            if (!_active || _y === val) return;
            _y = val;
            for (let i = 0, len = children.length; i < len; i++) {
                const c = children[i];
                if (c.ref.scene) c.ref.setPosition(c.ref.x, _y + c.offsetY * _scale);
            }
        },
        get y() { return _y; },

        setPosition: (newX, newY) => {
            if (!_active || (_x === newX && _y === newY)) return;
            _x = newX;
            _y = newY;
            for (let i = 0, len = children.length; i < len; i++) {
                const c = children[i];
                if (c.ref.scene) c.ref.setPosition(_x + c.offsetX * _scale, _y + c.offsetY * _scale);
            }
        },

        /**
         * moveBy: Purely relative movement. 
         */
        moveBy: (dx, dy) => {
            if (!_active || (dx === 0 && dy === 0)) return;
            _x += dx;
            _y += dy;
            for (let i = 0, len = children.length; i < len; i++) {
                const ref = children[i].ref;
                if (ref.scene) {
                    ref.x += dx;
                    ref.y += dy;
                }
            }
            return group;
        },

        /**
         * tweenBy: Relative movement using Absolute Offset updates
         */
        tweenBy: (deltaX, deltaY, config = {}) => {
            if (!_active || (deltaX === 0 && deltaY === 0)) return;
            const startX = _x;
            const startY = _y;

            scene.tweens.add({
                targets: { progress: 0 },
                progress: 1,
                ...config,
                onUpdate: (tween, target) => {
                    _x = startX + (deltaX * target.progress);
                    _y = startY + (deltaY * target.progress);
                    _syncChildren();
                }
            });
        },

        /**
         * tweenTo: Absolute movement using Absolute Offset updates
         */
        tweenTo: (targetX, targetY, config = {}) => {
            if (!_active) return;
            const startX = _x;
            const startY = _y;
            const distanceX = targetX - startX;
            const distanceY = targetY - startY;
            if (distanceX === 0 && distanceY === 0) return;

            scene.tweens.add({
                targets: { progress: 0 },
                progress: 1,
                ...config,
                onUpdate: (tween, target) => {
                    _x = startX + (distanceX * target.progress);
                    _y = startY + (distanceY * target.progress);
                    _syncChildren();
                }
            });
        },

        /**
         * recalculateOffsets: Update stored absolute offsets based on children's current positions.
         */
        recalculateOffsets: () => {
            for (let i = 0, len = children.length; i < len; i++) {
                const c = children[i];
                if (c.ref.scene) {
                    c.offsetX = (c.ref.x - _x) / _scale;
                    c.offsetY = (c.ref.y - _y) / _scale;
                    c.baseScaleX = c.ref.scaleX / _scale;
                    c.baseScaleY = c.ref.scaleY / _scale;
                }
            }
            return group;
        }
    };

    return group;
};
