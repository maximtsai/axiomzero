/**
 * High-Performance Virtual Group (Absolute Offset Version)
 * Fixes floating-point drift and adds external destruction safety.
 */
const createVirtualGroup = (scene, x = 0, y = 0) => {
    let children = [];
    let _x = x;
    let _y = y;

    const group = {
        add: (gameObject) => {
            children.push({
                ref: gameObject,
                offsetX: gameObject.x - _x,
                offsetY: gameObject.y - _y
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
            _x = val;
            children.forEach(c => {
                if (c.ref.scene) c.ref.setPosition(_x + c.offsetX, c.ref.y);
            });
        },
        get x() { return _x; },

        set y(val) {
            _y = val;
            children.forEach(c => {
                if (c.ref.scene) c.ref.setPosition(c.ref.x, _y + c.offsetY);
            });
        },
        get y() { return _y; },

        setPosition: (newX, newY) => {
            _x = newX;
            _y = newY;
            children.forEach(c => {
                if (c.ref.scene) c.ref.setPosition(_x + c.offsetX, _y + c.offsetY);
            });
        },

        /**
         * tweenBy: Relative movement using Absolute Offset updates
         */
        tweenBy: (deltaX, deltaY, config = {}) => {
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
                            c.ref.setPosition(_x + c.offsetX, _y + c.offsetY);
                        }
                    });
                }
            });
        },

        /**
         * tweenTo: Absolute movement using Absolute Offset updates
         */
        tweenTo: (targetX, targetY, config = {}) => {
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
                            c.ref.setPosition(_x + c.offsetX, _y + c.offsetY);
                        }
                    });
                }
            });
        }
    };

    return group;
};
