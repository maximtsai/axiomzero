/**
 * Secondary tooltip for extra information (e.g. Data Leak mechanics).
 * Appears alongside the main nodeTooltip.
 */
const secondaryTooltip = (() => {
    let container = null;
    let bg = null;
    let bgEdges = null;
    let titleT = null;
    let bodyT = null;

    const depth = GAME_CONSTANTS.DEPTH_POPUPS + 1; // Slightly above main tooltip
    const width = 280;

    function init() {
        if (container) return;

        container = PhaserScene.add.container(0, 0).setDepth(depth).setScrollFactor(0).setVisible(false);
        container.isTreeElement = true;

        bgEdges = PhaserScene.add.nineslice(0, 0, 'buttons', 'popup_edge_light.png', 100, 100, 22, 22, 22, 22)
            .setOrigin(0.5, 0)
            .setAlpha(1);
        container.add(bgEdges);

        bg = PhaserScene.add.image(0, 0, 'buttons', 'navy_pixel.png')
            .setOrigin(0.5, 0)
            .setAlpha(0.93);
        container.add(bg);

        const padding = 10;
        titleT = PhaserScene.add.text(-width / 2 + padding, 8, '', {
            fontFamily: 'Quantico-Bold',
            fontSize: '22px',
            color: '#ff5d5d', // Reddish warning color
            align: 'left',
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true }
        }).setOrigin(0, 0);
        container.add(titleT);

        bodyT = PhaserScene.add.rexBBCodeText(-width / 2 + padding, 36, '', {
            fontFamily: 'Quantico-Regular',
            fontSize: '22px',
            color: '#ffffff',
            align: 'left',
            wrap: { mode: 'word', width: width - (padding * 2) },
            lineSpacing: 4,
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true }
        }).setOrigin(0, 0);
        container.add(bodyT);

        // Route to UI camera
        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
            upgradeTree.assignToUICamera(container);
            container.list.forEach(child => upgradeTree.assignToUICamera(child));
        }
    }

    function _clearTweens() {
        if (container) {
            PhaserScene.tweens.killTweensOf(container);
        }
    }

    function show(x, y, title, body, side = 'right') {
        if (!container) init();
        _clearTweens();

        titleT.setText(title.toUpperCase());
        bodyT.setText(body);

        // Calculate total height based on body text
        const totalHeight = bodyT.y + bodyT.height + 10;
        bg.setDisplaySize(width, totalHeight);
        bgEdges.setSize(width + 42, totalHeight + 42); // Match edge offset scaling
        bgEdges.y = -21;

        // Position relative to main tooltip
        const offsetX = (side === 'right' ? 1 : -1) * (width / 2 + 10);
        container.setPosition(x + offsetX, y);
        container.setVisible(true);

        // Matching nodeTooltip's unique entrance animation
        container.setScale(0.8, 1.11).setAngle(6);
        PhaserScene.tweens.add({
            targets: container,
            scaleX: 1.06, scaleY: 0.97, angle: -2,
            duration: 80, ease: 'Quart.easeOut',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: container,
                    scaleX: 1, scaleY: 1, angle: 0,
                    easeParams: [2.4],
                    duration: 220, ease: 'Back.easeOut'
                });
            }
        });
    }

    function hide() {
        if (container) {
            _clearTweens();
            container.setVisible(false);
        }
    }

    return { init, show, hide };
})();
