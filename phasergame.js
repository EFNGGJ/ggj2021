var config = {
    type: Phaser.AUTO,
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
    }
};

var game = new Phaser.Game(config);

function preload ()
{

}

function create ()
{
    window.addEventListener('resize', resize.bind(this));

    function resize ()
    {
        let pixelRatio = window.devicePixelRatio;
        let w = window.innerWidth * window.devicePixelRatio;
        let h = window.innerHeight * window.devicePixelRatio;
        
        this.scale.resize(w , h);
    }
    var text = this.add.text(0, 20, 'emoji 😀', { fontSize: 200 * window.devicePixelRatio});
    text.setScale(1 / window.devicePixelRatio, 1 / window.devicePixelRatio);
}

function update ()
{
}
