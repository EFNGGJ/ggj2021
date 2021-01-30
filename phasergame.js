function include(file) { 
  var script  = document.createElement('script'); 
  script.src  = file; 
  script.type = 'text/javascript';   
  document.getElementsByTagName('head').item(0).appendChild(script); 
} 
include('https://cdn.jsdelivr.net/npm/phaser@3.19.0/dist/phaser-arcade-physics.js')
include('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js')
include('https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8/dist/teachablemachine-image.min.js')

const teachableMachineURL = "https://teachablemachine.withgoogle.com/models/GFwPntcSE/";

const config = {
    type: Phaser.AUTO,
    dom: {
        createContainer: true,
    },
    parent: 'game',
    backgroundColor: '#0072bc',
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
var webcam, model, maxPredictions, webcamGameObject, emojiGameObject, isPredicting;

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
    async function createWebcam()
    {
        let buildWebcam = new tmImage.Webcam(400, 400, false); // width, height, flip
        
        await buildWebcam.setup();
        await buildWebcam.play();    
        
        webcam = buildWebcam;
    }

    async function createModel()
    {
        const modelURL = teachableMachineURL + "model.json";
        const metadataURL = teachableMachineURL + "metadata.json";

        model = await tmImage.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();
    }

    await Promise.all([
        createWebcam.call(this),
        createModel.call(this),
    ]);
    await model.predict(webcam.canvas);


    let webcamCanvas = await webcam.canvas;
    
    slotDomObjects = [
        this.add.dom(0, 0, 'div', {'font-size': '200px'}, String.fromCodePoint(0x1F600)),
        this.add.dom(300, 0, 'div', {'font-size': '200px'}, String.fromCodePoint(0x1F62E)),
        this.add.dom(600, 0, 'div', {'font-size': '200px'}, String.fromCodePoint(0x1F600)),
        this.add.dom(300, 0, 'div', {'font-size': '200px'}, String.fromCodePoint(0x1F62E)),
    ];

    for (let slotIndex in slotDomObjects) {
        slotDomObjects[slotIndex].setScale(window.devicePixelRatio, window.devicePixelRatio);
    }
    emojiGameObject = slotDomObjects[slotDomObjects.length - 1]

    webcamGameObject = this.add.dom(0, 0, webcamCanvas, null, null),
    
    updateSlotPositionsAndDimensions();
    
    console.log('created')
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

async function update ()
{
    if(webcam) {
        webcam.update();
    } 
    
    if(!isPredicting && model && emojiGameObject) {
        isPredicting = true;
        const prediction = await model.predict(webcam.canvas);

        //console.log(prediction);

        if (prediction[0].probability > 0.7){
            emojiGameObject.node.innerHTML = "&#x1F600";
        } else if (prediction[1].probability > 0.7){
            emojiGameObject.node.innerHTML = "&#x1F62E";
        } else {
            emojiGameObject.node.innerHTML = "?";
        }   
        isPredicting = false;
    } 
}
