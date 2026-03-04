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
            start: 1,
            end: 7,
            zeroPad: 0,
        }),
        frameRate: 30,
        repeat: 0,
        yoyo: false
    });
}
