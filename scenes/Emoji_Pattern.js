import { Scene } from 'phaser';

import {EMOJI_PATTERN} from '../constants/scenes';

import emojiSounds from '../assets/Emoji/*.m4a';

import * as tf from '@tensorflow/tfjs';
import * as tmImage from '@teachablemachine/image';
import { get, sample, sampleSize, last } from 'lodash-es';

const teachableMachineURL = "https://teachablemachine.withgoogle.com/models/orHEjDtES/";
const goFaster = false;

var codePointToSound;

class EmojiTile {
    constructor (emoji, scene)
    {
        this._emoji = emoji;
        this.scene = scene;
    }

    set emoji (emoji)
    {
        if (this._emoji.name != emoji.name) {
            this._emoji = emoji;

            if(this._gameObject) {
                this._gameObject.node.innerHTML = emoji.string;
            }
        }
    }

    get emoji ()
    {
        return this._emoji;
    }
    
    get gameObject () 
    {
        if(!this._gameObject) {
            this._gameObject = this.scene.add.dom(0, 0, 'div', {'font-size': '200px'}, this._emoji.string);
        }
        return this._gameObject;
    }
}

class Emoji {
    constructor (name, codePoint, sound=null)
    {
        this.name = name
        this.codePoint = parseInt(codePoint)
        this.string = String.fromCodePoint(this.codePoint)
        this.sound = sound;
    }
}

/*
    To do: Time how long the viewer makes the correct face.
           Show the progress in the background of the guessed tile.
           Go to the next pattern at the right time.
           Play the correct sound when you make the right face.
           Put in real music.
*/

export default class Emoji_Pattern extends Scene
{
    init ()
    {
        this.state = 'loading';
        this.isPredicting = false;
        this.isUpdating = false;
        this.timer;
        this.holdLength = goFaster ? 750 : 2000; // Hold emoji for 2s to win
        this.debouncedGuesses = []
    }
    
    constructor ()
    {
        super(EMOJI_PATTERN);
    }

    preload ()
    {   
        window.addEventListener('resize', resize.bind(this));
        function resize ()
        {
            let pixelRatio = window.devicePixelRatio;
            let w = window.innerWidth * window.devicePixelRatio;
            let h = window.innerHeight * window.devicePixelRatio;
            
            this.scale.resize(w , h);
            this.updateTilePositions();
        }  

        this.stored_data = get(this.cache.json.get('data'), this.scene.key);
        this.patterns = this.stored_data.patterns;

        // Load emoji sounds based on name
        for (const e of this.stored_data.emoji) {
            if (e.hasSound) {
                this.load.audio(e.name, emojiSounds[e.name]);
            }
        }
    }

    async create ()
    {
        console.log('Creating');

        this.emoji = {}
        var available_emoji_names = []

        for (let e of this.stored_data.emoji) {
            var sound = null;

            if (e.hasSound) {
                sound = this.sound.add(e.name);
                available_emoji_names.push(e.name);
            }
            this.emoji[e.name] = new Emoji(e.name, e.codePoint, sound);
        }

        this.emojiTiles = [];
        let pattern = sample(this.patterns);
        let pattern_emoji = sampleSize(available_emoji_names, pattern.elementCount)

        for (let index of pattern.sequence) {
            let tile_emoji = this.emoji[pattern_emoji[index]]
            this.emojiTiles.push(new EmojiTile(tile_emoji, this));
        }

        this.targetEmoji = this.emoji[pattern_emoji[pattern.target]];
        this.previousEmojiGuess = this.emoji['mystery'];

        // Last tile is the question mark
        this.emojiTiles.push(new EmojiTile(this.emoji['mystery'], this));

        for (let tileIndex in this.emojiTiles) {
            this.emojiTiles[tileIndex].gameObject.setScale(window.devicePixelRatio, window.devicePixelRatio);
            this.emojiTiles[tileIndex].gameObject.alpha = 0;
        }
        
        this.guessedEmojiTile = this.emojiTiles[this.emojiTiles.length - 1];
        this.guessedEmojiTile.gameObject.node.style.border = '10px solid var(--color-pink)';
        this.guessedEmojiTile.gameObject.node.style.backgroundColor = 'var(--color-yellow)'; 
        
        this.updateTilePositions();
        
        async function createWebcam()
        {
            let buildWebcam = new tmImage.Webcam(600, 600, true); // width, height, flip
            
            await buildWebcam.setup();
            await buildWebcam.play();    
            
            this.webcam = buildWebcam;
        }

        let buildModel;
        async function createModel()
        {
            const modelURL = teachableMachineURL + "model.json";
            const metadataURL = teachableMachineURL + "metadata.json";

            buildModel = await tmImage.load(modelURL, metadataURL);
            this.maxPredictions = buildModel.getTotalClasses();
        }

        await Promise.all([
            createWebcam.call(this),
            createModel.call(this),
        ]);
        
        // First call to predict is very slow and hangs the main thread,
        // so do it here before it gets called in update().
        await buildModel.predict(this.webcam.canvas);
        
        this.model = buildModel;

        let webcamCanvas = await this.webcam.canvas;

        this.webcamGameObject = this.add.dom(0, 0, webcamCanvas, null, null),
        this.webcamGameObject.alpha = 1;

        this.updateTilePositions();
        
        this.state = 'revealing'
        this.revealTiles([...this.emojiTiles]);
    }


    updateTilePositions () 
    {
        let y = window.innerHeight * window.devicePixelRatio / 3;
        if(this.emojiTiles) {
            let count = this.emojiTiles.length;
            let xOffset = window.innerWidth * window.devicePixelRatio / (count + 1);
            let x = 0;
            for(let i = 0; i < count; ++i) {
                x += xOffset;
                this.emojiTiles[i].gameObject.x = x;
                this.emojiTiles[i].gameObject.y = y;
            }
        }
        if(this.webcamGameObject) {
            this.webcamGameObject.x = window.innerWidth * window.devicePixelRatio / 2;
            this.webcamGameObject.y = y * 2;
        }     
    }

    revealTiles (tiles)
    {
        // Get the first tile in the array, and remove it from the array.
        let tile = tiles.shift()
        
        // Animate it in.
        var tween = this.tweens.add({
            targets: tile.gameObject,
            alpha: { value: 1.0, duration: goFaster ? 200 : 2000 },  
            
            // If there are any tiles left, add a completion handler to this 
            // animation that will call this function again to animate the next one.
            // If there are no tiles left, switch our state to 'playing' after the
            // animation completes.
            onComplete:  tiles.length > 0 ? 
                () => { this.revealTiles(tiles); } : 
                () => { this.state = 'playing'; console.log("playing") }
        });
        
        // Play the appropriate sound.
        let sound = tile.emoji.sound;
        if(sound) {
            sound.play();
        }
    }

    switchGuess (emoji_name)
    {
       /* this.debouncedGuesses.add([_.now(), emojiName]);

        let timeNow = _.now()
        let halfASecondAgo = timeNow - 500;
        
        while(_(debouncedGuesses).first().first() < halfASecondAgo) {
            debouncedGuesses.shift();
        }
        
        var result = _.head(_(debouncedGuesses)
        .countBy()
        .entries()
        .maxBy(_.last));*/
        
        if(emoji_name != this.previousEmojiGuess.name) {
            console.log(`new guess: ${emoji_name}`);
            if (emoji_name == this.targetEmoji.name) {    
                // Start the timer!
                this.timer = this.time.addEvent({
                    delay: this.holdLength,
                    repeat: 0,
                    callback: this.success,
                    callbackScope: this
                })
            } else {
                // This guess is wrong! 
                // Stop the timer.
                if (this.timer) {
                    this.timer.remove();
                    this.timer = null;                             
                }
            }
            
            this.guessedEmojiTile.emoji = this.emoji[emoji_name];
            this.previousEmojiGuess = this.guessedEmojiTile.emoji;
        }
    }

    async update ()
    {
        // Guard here in case update() is getting called faster than we
        // can actually do all the things (this function is async, so it
        // will potentially return control to the main loop at any await
        // point).
        if(!this.isUpdating) {
            this.isUpdating = true;
            // console.log('update');

            switch(this.state) {
                default: {
                    break;
                }
                case 'playing': { 
                    await this.webcam.update();  
                        
                    // If we're not already predicting, start a prediction.
                    // Again, we guard in case we're getting called faster than
                    // the prediction can handle.
                    if(!this.isPredicting) {
                        this.isPredicting = true;
                        // console.log('predict');
    
                        // Turns out this doesn't work in practice - we only get
                        // the same number of update calls as predict calls.
                        // I think this is because the predict call, while async,
                        // actually ends up tying up the runloop anyway :-(
                        this.model.predict(this.webcam.canvas).then((predictions) => {
                            // console.log(prediction);
    
                            const threshold = 0.4;
                            const emoji_names = [
                                'happy', 
                                'surprised', 
                                'angry', 
                                'sleepy',
                                'silly',
                            ];
                                                    
                            var bestPredictionProbability = 0;
                            var bestPredictionIndex;
                            predictions.forEach((prediction, index, array) => {
                                if(index < emoji_names.length) {
                                    if(bestPredictionProbability < prediction.probability) {
                                        bestPredictionIndex = index;
                                        bestPredictionProbability = prediction.probability;
                                    }
                                }
                            });
    
                            //console.log(`Prediction index: ${bestPredictionIndex}, Prediction probability: ${Math.round(bestPredictionProbability * 100)}%`);
    
                            const emoji_name = (() => {
                                if(bestPredictionProbability >= threshold) {
                                    return emoji_names[bestPredictionIndex];
                                } else {
                                    return 'mystery';
                                }
                            })();
    
                            // console.log(emoji_name);
                            
                            this.switchGuess(emoji_name);

                            
                            // console.log('endPredict');
                            this.isPredicting = false;
                        });
                    }
                    
                    // Update the progress towards the win.
                    let percent = this.timer ? (this.timer.getProgress() * 100) : 0;
                    let newBackground = `linear-gradient(0, var(--color-orange) ${percent}%, var(--color-yellow) ${percent}%)`;
                    this.guessedEmojiTile.gameObject.node.style.background = newBackground
                }
                break;
            }
            
            //console.log('endUpdate');
            this.isUpdating = false; 
        }
    }

    success ()
    {
        console.log("Success!");
        this.state = 'success';
        
        let sound = last(this.emojiTiles).emoji.sound
        if(sound) {
            sound.play();
        }

        var tween = this.tweens.add({
            targets: this.emojiTiles.map(tile => { return tile.gameObject }).concat([this.webcamGameObject]),
            
            delay: 200,
            duration: goFaster ? 250 : 500,
            
            alpha: { value: 0.0 },        
            scale: '*=1.5',  
            angle: { value: 359 },
            
            onComplete: () => { 
                this.state = 'restarting';
                console.log('restarting!');
                this.scene.restart();
            }    
        });
    }
}
