import Phaser from 'phaser';

import Init from './scenes/Init';
import Emoji from './scenes/Emoji';

const config = {
    type: Phaser.AUTO,
    dom: {
        createContainer: true,
    },
    parent: 'game',
    backgroundColor: '#70d6ff',
    scale: {
        mode: Phaser.Scale.NONE,
        width: window.innerWidth * window.devicePixelRatio,
        height: window.innerHeight * window.devicePixelRatio,
        zoom: 1 / window.devicePixelRatio,
    },
    scene: [Init, Emoji],
};

const game = new Phaser.Game(config);
