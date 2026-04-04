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

    const group = {
        activate: () => { _active = true; return group; },
        deactivate: () => { _active = false; return group; },
        isActive: () => _active,

        add: (gameObject) => {
            // Auto-clean any dead references to prevent memory leaks from destroyed objects
            children = children.filter(c => c.ref && c.ref.scene);

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
            children.forEach(c => {
                if (c.ref.scene) c.ref.alpha = value;
            });
            return group;
        },

        // Instant Scale
        setScale: (value) => {
            _scale = value;
            children.forEach(c => {
                if (c.ref.scene) {
                    c.ref.setScale(c.baseScaleX * _scale, c.baseScaleY * _scale);
                    c.ref.setPosition(_x + c.offsetX * _scale, _y + c.offsetY * _scale);
                }
            });
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

            const startX = _x;
            const startY = _y;
            const pivotX = (config.pivotX !== undefined) ? config.pivotX : _x;
            const pivotY = (config.pivotY !== undefined) ? config.pivotY : _y;

            _scaleTween = scene.tweens.add({
                targets: { progress: 0 },
                progress: 1,
                ...config,
                onUpdate: (tween, target) => {
                    const currentScale = startScale + (diffScale * target.progress);

                    // Re-calculate group origin to keep pivot anchored
                    _scale = currentScale;
                    _x = pivotX - ((pivotX - startX) / startScale) * _scale;
                    _y = pivotY - ((pivotY - startY) / startScale) * _scale;

                    children.forEach(c => {
                        if (c.ref.scene) {
                            c.ref.setScale(c.baseScaleX * _scale, c.baseScaleY * _scale);
                            c.ref.setPosition(_x + c.offsetX * _scale, _y + c.offsetY * _scale);
                        }
                    });
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
            const activeChildren = children.filter(c => c.ref.scene).map(c => c.ref);
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
            children = children.filter(c => c.ref !== gameObject);
        },

        removeAllChildren: () => {
            children = [];
        },

        destroy: () => {
            children.forEach(c => {
                if (c.ref && c.ref.destroy) c.ref.destroy();
            });
            children = [];
        },

        // --- POSITIONING ENGINE (Absolute Offset Logic) ---

        set x(val) {
            if (!_active) return;
            _x = val;
            children.forEach(c => {
                if (c.ref.scene) c.ref.setPosition(_x + c.offsetX * _scale, c.ref.y);
            });
        },
        get x() { return _x; },

        set y(val) {
            if (!_active) return;
            _y = val;
            children.forEach(c => {
                if (c.ref.scene) c.ref.setPosition(c.ref.x, _y + c.offsetY * _scale);
            });
        },
        get y() { return _y; },

        setPosition: (newX, newY) => {
            if (!_active) return;
            _x = newX;
            _y = newY;
            children.forEach(c => {
                if (c.ref.scene) c.ref.setPosition(_x + c.offsetX * _scale, _y + c.offsetY * _scale);
            });
        },

        /**
         * moveBy: Purely relative movement. 
         * Shits the group center AND all children by a delta.
         * If an object is in multiple groups, calling moveBy on any of them 
         * will stack the movement additively on the child.
         */
        moveBy: (dx, dy) => {
            if (!_active) return;
            _x += dx;
            _y += dy;
            children.forEach(c => {
                if (c.ref.scene) {
                    c.ref.x += dx;
                    c.ref.y += dy;
                }
            });
            return group;
        },

        /**
         * tweenBy: Relative movement using Absolute Offset updates
         */
        tweenBy: (deltaX, deltaY, config = {}) => {
            if (!_active) return;
            const startX = _x;
            const startY = _y;

            scene.tweens.add({
                targets: { progress: 0 },
                progress: 1,
                ...config,
                onUpdate: (tween, target) => {
                    // Calculate the current master position based on tween progress
                    _x = startX + (deltaX * target.progress);
                    _y = startY + (deltaY * target.progress);

                    // Map children to the master position using their stored offsets
                    children.forEach(c => {
                        if (c.ref.scene) {
                            c.ref.setPosition(_x + c.offsetX * _scale, _y + c.offsetY * _scale);
                        }
                    });
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

            scene.tweens.add({
                targets: { progress: 0 },
                progress: 1,
                ...config,
                onUpdate: (tween, target) => {
                    _x = startX + (distanceX * target.progress);
                    _y = startY + (distanceY * target.progress);

                    children.forEach(c => {
                        if (c.ref.scene) {
                            c.ref.setPosition(_x + c.offsetX * _scale, _y + c.offsetY * _scale);
                        }
                    });
                }
            });
        },

        /**
         * recalculateOffsets: Update stored absolute offsets based on children's current positions.
         * Use this if you manually move a child object and want the group to respect its new position.
         */
        recalculateOffsets: () => {
            children.forEach(c => {
                if (c.ref.scene) {
                    c.offsetX = (c.ref.x - _x) / _scale;
                    c.offsetY = (c.ref.y - _y) / _scale;
                    c.baseScaleX = c.ref.scaleX / _scale;
                    c.baseScaleY = c.ref.scaleY / _scale;
                }
            });
            return group;
        }
    };

    return group;
};
