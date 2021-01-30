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


function preload ()
{   
    window.addEventListener('resize', resize.bind(this));
     
    function resize ()
    {
        let pixelRatio = window.devicePixelRatio;
        let w = window.innerWidth * window.devicePixelRatio;
        let h = window.innerHeight * window.devicePixelRatio;
        
        this.scale.resize(w , h);
    }
}

async function create ()
{
    let buildWebcam = new tmImage.Webcam(300, 300, false); // width, height, flip
    
    await buildWebcam.setup();
    await buildWebcam.play();
    
    let webcamCanvas = await buildWebcam.canvas;
    
    let webcamGameObject = this.add.dom(500, 500, webcamCanvas, {scale: window.devicePixelRatio}, null);
    webcamGameObject.setScale(window.devicePixelRatio, window.devicePixelRatio)
    
    webcam = buildWebcam;
    
    
    const modelURL = teachableMachineURL + "model.json";
    const metadataURL = teachableMachineURL + "metadata.json";

    // load the model and metadata
    // Refer to tmImage.loadFromFiles() in the API to support files from a file picker
    // or files from your local hard drive
    // Note: the pose library adds "tmImage" object to your window (window.tmImage)
    model = await tmImage.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();

    emojiGameObject = this.add.dom(800, 300, 'div', {'font-size': '200px'}, '😀');
    emojiGameObject.setScale(window.devicePixelRatio, window.devicePixelRatio)
}

async function update ()
{
    if(webcam) {
        webcam.update();
    } 
    
    if(!isPredicting && model && emojiGameObject) {
        isPredicting = true;
        const prediction = await model.predict(webcam.canvas);

        console.log(prediction);

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
