import { Scene } from 'phaser';

import {INIT, EMOJI} from '../constants/scenes';

import assets from '../assets/Init/*.*'

export default class Init extends Scene {
	constructor ()
	{
		super(INIT);
	}

	preload ()
	{
		this.load.json('data', assets.data.json);
        this.load.on('complete', this.onLoadComplete, this);
	}

	onLoadComplete (loader)
	{
		this.scene.start(EMOJI);
        this.scene.shutdown();
	}
}