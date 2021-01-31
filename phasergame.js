import Phaser from 'phaser';

import * as tf from '@tensorflow/tfjs';
import * as tmImage from '@teachablemachine/image';

const teachableMachineURL = "https://teachablemachine.withgoogle.com/models/GFwPntcSE/";
 
var webcam, model, maxPredictions, webcamGameObject, guessedEmojiTile, isPredicting, isUpdating;

var emojiTiles;

var codePointToSound;

class EmojiTile {
    constructor (codePoint, scene)
    {
        this.codePoint = codePoint;   
        this.scene = scene;     
    }  
    
    set codePoint (codePoint) {
        if(this._codePoint != codePoint) {
            this._codePoint = codePoint;
            if(this._gameObject) {
                this._gameObject.node.innerHTML = String.fromCodePoint(codePoint)
            }
        }
    }
    
    get codePoint () {
        return this._codePoint;
    }
    
    get gameObject () 
    {
        if(!this._gameObject) {
            this._gameObject = this.scene.add.dom(0, 0, 'div', {'font-size': '200px'}, String.fromCodePoint(this.codePoint));
        }
        return this._gameObject;
    }
}

/*
    To do: read in the pattern dynamically.
           Time how long the viewer makes the correct face.
           Show the progress in the background of the guessed tile.
           Go to the next pattern at the right time.
           Play the correct sound when you make the right face.
           Put in real music.
*/

class MainScene extends Phaser.Scene
{
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
        
        // You have to require them like this so that parcel will 
        // pick up that it has to package the files. If you just hard-code
        // a URL, parcel will not package it and it will not make it to the
        // web server.
        let happyUrl = require('./audio/happy.m4a');
        let sleepyUrl = require('./audio/sleepy.m4a');
        let angryUrl = require('./audio/angry.m4a');
        let surprisedUrl = require('./audio/surprised.m4a');

        this.load.audio('happy', happyUrl);
        this.load.audio('surprised', surprisedUrl);
        this.load.audio('sleepy', sleepyUrl);
        this.load.audio('angry', angryUrl);
    }

    async create ()
    {
        console.log('Creating');

        codePointToSound = {
            0x1F600: this.sound.add('happy'),
            0x1F62E: this.sound.add('surprised'),
        //sleepy = this.sound.add('sleepy');
        //angry = this.sound.add('angry');
        }

        emojiTiles = [
            new EmojiTile(0x1F600, this),
            new EmojiTile(0x1F62E, this),
            new EmojiTile(0x1F600, this),
            new EmojiTile(0x2753, this),
        ];

        for (let tileIndex in emojiTiles) {
            emojiTiles[tileIndex].gameObject.setScale(window.devicePixelRatio, window.devicePixelRatio);
            emojiTiles[tileIndex].gameObject.alpha = 0;
        }
        
        guessedEmojiTile = emojiTiles[emojiTiles.length - 1];
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
        
        this.revealTiles([...emojiTiles]);
    }


    updateTilePositions () 
    {
        let y = window.innerHeight * window.devicePixelRatio / 3;
        if(emojiTiles) {
            let count = emojiTiles.length;
            let xOffset = window.innerWidth * window.devicePixelRatio / (count + 1);
            let x = 0;
            for(let i = 0; i < count; ++i) {
                x += xOffset;
                emojiTiles[i].gameObject.x = x;
                emojiTiles[i].gameObject.y = y;
            }
        }
        if(webcamGameObject) {
            webcamGameObject.x = window.innerWidth * window.devicePixelRatio / 2;
            webcamGameObject.y = y * 2;
        }     
    }

    revealTiles (tiles)
    {
        // Animate the first tile in the array, and remove it from the array.
        var tween = this.tweens.add({
            targets: tiles.shift().gameObject,
            alpha: { value: 1.0, duration: 2000 },        
        });
        
        // Play the appropriate sound.
        let sound = codePointToSound[tiles[0].codePoint];
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
            
            //console.log('update');
            if(webcam && guessedEmojiTile.gameObject.alpha > 0.9) { //check alpha of final domslot
                await webcam.update();  
                
                // If we're not already predicting, start a prediction.
                // Again, we guard in case we're getting called faster than
                // the prediction can handle.
                if(!isPredicting && model && guessedEmojiTile) {
                    isPredicting = true;
                    const prediction = await model.predict(webcam.canvas);

                    //console.log(prediction);

                    let codePoint = 0x2753;
                    if (prediction[0].probability > 0.7){
                        codePoint = 0x1F600;
                    } else if (prediction[1].probability > 0.7){
                        codePoint = 0x1F62E;
                    } 
                    
                    //console.log(String.fromCodePoint(codePoint));
                    guessedEmojiTile.codePoint = codePoint;
                     
                    isPredicting = false;
                }
            }

            isUpdating = false; 
        }
    }
}

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
    scene: [MainScene],
};

const game = new Phaser.Game(config);
