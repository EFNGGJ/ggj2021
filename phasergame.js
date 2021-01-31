const teachableMachineURL = "https://teachablemachine.withgoogle.com/models/GFwPntcSE/";

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
    scene: {
        preload: preload,
        create: create,
        update: update
    },
};

const game = new Phaser.Game(config);
var webcam, model, maxPredictions, webcamGameObject, emojiGameObject, isPredicting, isUpdating;

var slotDomObjects;

function preload ()
{   
    window.addEventListener('resize', resize.bind(this));

    this.load.audio('happy', 'audio/happy.mp4');
    this.load.audio('surprised', 'audio/surprised.mp4');
    this.load.audio('sleepy', 'audio/sleepy.mp4');
    this.load.audio('angry', 'audio/angry.mp4');
     
    function resize ()
    {
        let pixelRatio = window.devicePixelRatio;
        let w = window.innerWidth * window.devicePixelRatio;
        let h = window.innerHeight * window.devicePixelRatio;
        
        this.scale.resize(w , h);
        updateSlotPositionsAndDimensions();
    }
}

async function create ()
{
    slotDomObjects = [
        this.add.dom(0, 0, 'div', {'font-size': '200px'}, String.fromCodePoint(0x1F600)),
        this.add.dom(300, 0, 'div', {'font-size': '200px'}, String.fromCodePoint(0x1F62E)),
        this.add.dom(600, 0, 'div', {'font-size': '200px'}, String.fromCodePoint(0x1F600)),
        this.add.dom(300, 0, 'div', {'font-size': '200px', 'border': '10px solid #ff70a6', 'background-color': '#ffd670'}, String.fromCodePoint(0x2753)),
    ];

    for (let slotIndex in slotDomObjects) {
        slotDomObjects[slotIndex].setScale(window.devicePixelRatio, window.devicePixelRatio);
        slotDomObjects[slotIndex].alpha = 0;
    }
    emojiGameObject = slotDomObjects[slotDomObjects.length - 1]
    updateSlotPositionsAndDimensions();
    
    async function createWebcam()
    {
        let buildWebcam = new tmImage.Webcam(400, 400, true); // width, height, flip
        
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
    webcamGameObject.alpha = 0;

    updateSlotPositionsAndDimensions();
    
    revealGameObjects.call(this, slotDomObjects.concat([webcamGameObject]));
}

function updateSlotPositionsAndDimensions() 
{
    let y = window.innerHeight * window.devicePixelRatio / 3;
    if(slotDomObjects) {
        let count = slotDomObjects.length;
        let xOffset = window.innerWidth * window.devicePixelRatio / (count + 1);
        let x = 0;
        for(let i = 0; i < count; ++i) {
            x += xOffset;
            slotDomObjects[i].x = x;
            slotDomObjects[i].y = y;
        }
    }
    if(webcamGameObject) {
        webcamGameObject.x = window.innerWidth * window.devicePixelRatio / 2;
        webcamGameObject.y = y * 2;
    }     
}

function revealGameObjects(gameObjects)
{
    var tween = this.tweens.add({
        targets: gameObjects.shift(),
        alpha: { value: 1.5, duration: 100 },        
    });
    
    if(gameObjects.length > 0) {
        tween.addListener(
            'complete',
            () => { revealGameObjects.call(this, gameObjects) }
        );
    }
}

async function update ()
{
    if(!isUpdating) {
        console.log('update');
        isUpdating = true;
        
        if(webcam) {
            await webcam.update();  
            
            if(!isPredicting && model && emojiGameObject) {
                isPredicting = true;
                const prediction = await model.predict(webcam.canvas);

                //console.log(prediction);

                if (prediction[0].probability > 0.7){
                    emojiGameObject.node.innerHTML = "&#x1F600";
                } else if (prediction[1].probability > 0.7){
                    emojiGameObject.node.innerHTML = "&#x1F62E";
                } else {
                    emojiGameObject.node.innerHTML = "&#x2753";
                }   
                isPredicting = false;
            }
        }

        isUpdating = false; 
    }
}
