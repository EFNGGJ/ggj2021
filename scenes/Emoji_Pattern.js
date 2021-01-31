import { Scene } from 'phaser';

import {EMOJI_PATTERN} from '../constants/scenes';

import emojiSounds from '../assets/Emoji/*.m4a';

import * as tf from '@tensorflow/tfjs';
import * as tmImage from '@teachablemachine/image';
import { get, sample, sampleSize } from 'lodash-es';

const teachableMachineURL = "https://teachablemachine.withgoogle.com/models/GFwPntcSE/";
const goFaster = false;
 
var webcam, model, maxPredictions, webcamGameObject, guessedEmojiTile, isPredicting, isUpdating;

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
        this.timer;
        this.holdLength = goFaster ? 750 : 2000; // Hold emoji for 2s to win
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
        
        guessedEmojiTile = this.emojiTiles[this.emojiTiles.length - 1];
        guessedEmojiTile.gameObject.node.style.border = '10px solid #ff70a6';
        guessedEmojiTile.gameObject.node.style.backgroundColor = '#ffd670'; 
        
        this.updateTilePositions();
        
        async function createWebcam()
        {
            let buildWebcam = new tmImage.Webcam(600, 600, true); // width, height, flip
            
            await buildWebcam.setup();
            await buildWebcam.play();    
            
            webcam = buildWebcam;
        }

        let buildModel;
        async function createModel()
        {
            const modelURL = teachableMachineURL + "model.json";
            const metadataURL = teachableMachineURL + "metadata.json";

            buildModel = await tmImage.load(modelURL, metadataURL);
            maxPredictions = buildModel.getTotalClasses();
        }

        await Promise.all([
            createWebcam.call(this),
            createModel.call(this),
        ]);
        
        // First call to predict is very slow and hangs the main thread,
        // so do it here before it gets called in update().
        await buildModel.predict(webcam.canvas);
        
        model = buildModel;

        let webcamCanvas = await webcam.canvas;

        webcamGameObject = this.add.dom(0, 0, webcamCanvas, null, null),
        webcamGameObject.alpha = 1;

        this.updateTilePositions();
        
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
        if(webcamGameObject) {
            webcamGameObject.x = window.innerWidth * window.devicePixelRatio / 2;
            webcamGameObject.y = y * 2;
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
        });
        
        // Play the appropriate sound.
        let sound = tile.emoji.sound;
        if(sound) {
            sound.play();
        }
        
        // If there are any tiles left, add a completion handler to this 
        // animation that will call this function again to animate the next one.
        if(tiles.length > 0) {
            tween.addListener(
                'complete',
                () => { this.revealTiles(tiles) }
            );
        }
    }

    async update ()
    {
        // Guard here in case update() is getting called faster than we
        // can actually do all the things (this function is async, so it
        // will potentially return control to the main loop at any await
        // point).
        if(!isUpdating) {
            isUpdating = true;
            
            // console.log('update');
            if(webcam && guessedEmojiTile.gameObject.alpha > 0.9) { //check alpha of final domslot
                await webcam.update();  
                
                // If we're not already predicting, start a prediction.
                // Again, we guard in case we're getting called faster than
                // the prediction can handle.
                if(!isPredicting && model && guessedEmojiTile) {
                    isPredicting = true;
                    // console.log('predict');

                    // Turns out this doesn't work in practice - we only get
                    // the same number of update calls as predict calls.
                    // I think this is because the predict call, while async,
                    // actually ends up tying up the runloop anyway :-(
                    model.predict(webcam.canvas).then((prediction) => {
                        // console.log(prediction);

                        let emoji_name = 'mystery';
                        if (prediction[0].probability > 0.7){
                            emoji_name = 'happy';
                        } else if (prediction[1].probability > 0.7){
                            emoji_name = 'surprised';
                        } 
                        
                        // console.log(emoji_name);
                        // Check if the emoji is completely new
                        if (emoji_name == this.targetEmoji.name &&
                            emoji_name != this.previousEmojiGuess.name) {
                            console.log(`new guess: ${emoji_name}`);
                        
                            // reset timer
                            this.timer = this.time.addEvent({
                                delay: this.holdLength,
                                repeat: 0,
                                callback: this.success,
                                callbackScope: this
                            })
                        } else if (emoji_name != this.targetEmoji.name) {
                            if (this.timer !== undefined) {
                                this.timer.remove();                                
                            }
                        }

                        guessedEmojiTile.emoji = this.emoji[emoji_name];
                        this.previousEmojiGuess = guessedEmojiTile.emoji;
                        
                        // console.log('endPredict');
                        isPredicting = false;
                    });
                }
                
                // Update the progress towards the win.
                let percent = this.timer ? (this.timer.getProgress() * 100) : 0;
                let newBackground = `linear-gradient(0, var(--color-orange) ${percent}%, var(--color-yellow) ${percent}%)`;
                guessedEmojiTile.gameObject.node.style.background = newBackground
            }
            //console.log('endUpdate');

            isUpdating = false; 
        }
    }

    success ()
    {
        console.log("Success!");
    }
}
