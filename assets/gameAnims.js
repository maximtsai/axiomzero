function createAnimations(scene) {
    scene.anims.create({
        key: 'hit_circle',
        frames: scene.anims.generateFrameNames('attacks', {
            prefix: 'hit_circle',
            suffix: '.png',
            start: 1,
            end: 12,
            zeroPad: 0,
        }),
        frameRate: 20,
        repeat: 0,
        yoyo: false
    });
}
