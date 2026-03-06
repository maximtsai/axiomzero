function createAnimations(scene) {
    scene.anims.create({
        key: 'hit_circle',
        frames: scene.anims.generateFrameNames('attacks', {
            prefix: 'hit_circle',
            suffix: '.png',
            start: 1,
            end: 10,
            zeroPad: 0,
        }),
        frameRate: 30,
        repeat: 0,
        yoyo: false
    });

    scene.anims.create({
        key: 'enemy_strike',
        frames: scene.anims.generateFrameNames('attacks', {
            prefix: 'enemy_strike',
            suffix: '.png',
            start: 0,
            end: 7,
            zeroPad: 0,
        }),
        frameRate: 20,
        repeat: 0,
    });

    scene.anims.create({
        key: 'explosion_anim',
        frames: scene.anims.generateFrameNames('enemies', {
            prefix: 'explosion_anim',
            start: 1,
            end: 11,
            zeroPad: 0,
        }),
        frameRate: 20,
        repeat: 0,
        hideOnComplete: false
    });
}
