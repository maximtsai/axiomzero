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
            suffix: '.png',
            start: 0,
            end: 11,
            zeroPad: 0,
        }),
        frameRate: 20,
        repeat: 0,
        hideOnComplete: false
    });

    scene.anims.create({
        key: 'explosion_pulse',
        frames: scene.anims.generateFrameNames('attacks', {
            prefix: 'explosion_pulse',
            suffix: '.png',
            start: 0,
            end: 12,
            zeroPad: 0,
        }),
        frameRate: 24,
        repeat: 0,
    });
    scene.anims.create({
        key: 'explosion_pulse_slow',
        frames: scene.anims.generateFrameNames('attacks', {
            prefix: 'explosion_pulse',
            suffix: '.png',
            start: 0,
            end: 12,
            zeroPad: 0,
        }),
        frameRate: 12,
        repeat: 0,
    });
    scene.anims.create({
        key: 'enemy_hit_circle',
        frames: scene.anims.generateFrameNames('attacks', {
            prefix: 'enemy_hit_circle',
            suffix: '.png',
            start: 1,
            end: 8,
            zeroPad: 0,
        }),
        frameRate: 24,
        repeat: 0,
    });
    scene.anims.create({
        key: 'enemy_hit_circle_slow',
        frames: scene.anims.generateFrameNames('attacks', {
            prefix: 'enemy_hit_circle',
            suffix: '.png',
            start: 0,
            end: 8,
            zeroPad: 0,
        }),
        frameRate: 16,
        repeat: 0,
    });

    scene.anims.create({
        key: 'sniper_bullet',
        frames: [
            { key: 'enemies', frame: 'sniper_projectile_big1.png' },
            { key: 'enemies', frame: 'sniper_projectile_big2.png' }
        ],
        frameRate: 12,
        repeat: -1
    });
}
