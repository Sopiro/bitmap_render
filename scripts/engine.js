import { Camera } from "./camera.js";
import { Bitmap } from "./bitmap.js";
import { Renderer } from "./renderer.js";
import * as Util from "./utils.js";
import * as Resources from "./resources.js";
import { Constants } from "./constants.js";
import * as Input from "./input.js";
import { Game } from "./game.js";
import { postProcess } from "./postprocess.js";

export class Engine
{
    constructor()
    {
        this.times = [];
        this.fps;

        this.started = false;

        this.cvs;
        this.tmpCvs;
        this.gfx;
        this.tmpGfx;

        this.resBtns = [];
        this.pspBtns = [];

        this.frameCounterElement;

        this.time = 0;

        this.renderer;
        this.game;

        this.postprocessEnabled = [false, false, true, false, false];
    }

    start()
    {
        this.init();
        this.run();
    }

    init()
    {
        this.cvs = document.getElementById("canvas");
        this.gfx = this.cvs.getContext("2d");

        this.gfx.font = "60px verdana";
        this.gfx.fillText("Loading...", 10, 60);

        this.tmpCvs = document.createElement("canvas");
        this.tmpGfx = this.tmpCvs.getContext("2d");

        this.resBtns.push(document.getElementById("res1"));
        this.resBtns.push(document.getElementById("res2"));
        this.resBtns.push(document.getElementById("res4"));
        this.resBtns.push(document.getElementById("res5"));
        this.resBtns.push(document.getElementById("res8"));
        this.resBtns.push(document.getElementById("res10"));
        this.resBtns.push(document.getElementById("res20"));

        function reloadView(index)
        {
            if (index == Constants.SCALES[index]) return;

            const newWidth = Constants.WIDTH * Constants.SCALE / Constants.SCALES[index];
            const newHeight = Constants.HEIGHT * Constants.SCALE / Constants.SCALES[index];
            this.renderer = new Renderer(newWidth, newHeight, this.camera);
            this.game.r = this.renderer;

            Constants.WIDTH = newWidth;
            Constants.HEIGHT = newHeight;
            Constants.SCALE = Constants.SCALES[index];
            Constants.FOV = Constants.HEIGHT;

            this.tmpCvs.width = Constants.WIDTH;
            this.tmpCvs.height = Constants.HEIGHT;

            for (const btn of this.resBtns) btn.style.backgroundColor = "white";
            this.resBtns[index].style.backgroundColor = "black";
        }

        for (let i = 0; i < this.resBtns.length; i++)
        {
            const btn = this.resBtns[i];
            btn.onclick = () => reloadView.bind(this)(i);
        }

        this.resBtns[Constants.SCALE_INDEX].style.backgroundColor = "black";

        this.pspBtns.push(document.getElementById("psp1"));
        this.pspBtns.push(document.getElementById("psp2"));
        this.pspBtns.push(document.getElementById("psp3"));
        this.pspBtns.push(document.getElementById("psp4"));
        this.pspBtns.push(document.getElementById("psp5"));

        function setPostProcess(index)
        {
            this.postprocessEnabled[index] = !this.postprocessEnabled[index];
            this.pspBtns[index].style.backgroundColor = this.postprocessEnabled[index] ? "black" : "white";
        }

        for (let i = 0; i < this.pspBtns.length; i++)
        {
            const btn = this.pspBtns[i];
            btn.onclick = () => setPostProcess.bind(this)(i);
            if (this.postprocessEnabled[i]) btn.style.backgroundColor = "black";
        }

        for (const key in Resources.textures)
        {
            if (Object.hasOwnProperty.call(Resources.textures, key))
            {
                const imageURL = Resources.textures[key][0];
                const imageWidth = Resources.textures[key][1][0];
                const imageHeight = Resources.textures[key][1][1];

                let image = new Image();
                image.src = imageURL;
                image.crossOrigin = "Anonymous";
                image.onload = () =>
                {
                    this.tmpCvs.setAttribute("width", imageWidth + "px");
                    this.tmpCvs.setAttribute("height", imageHeight + "px");
                    // Loading textures.

                    this.tmpGfx.drawImage(image, 0, 0, imageWidth, imageHeight);

                    if (key == "skybox")
                    {
                        const size = Util.int(imageWidth / 4);

                        let top = this.tmpGfx.getImageData(size, 0, size, size);
                        let bottom = this.tmpGfx.getImageData(size, size * 2, size, size);
                        let front = this.tmpGfx.getImageData(size, size, size, size);
                        let back = this.tmpGfx.getImageData(size * 3, size, size, size);
                        let right = this.tmpGfx.getImageData(size * 2, size, size, size);
                        let left = this.tmpGfx.getImageData(0, size, size, size);

                        Resources.textures["skybox_top"] = Util.convertImageDataToBitmap(top, size, size);
                        Resources.textures["skybox_bottom"] = Util.convertImageDataToBitmap(bottom, size, size);
                        Resources.textures["skybox_front"] = Util.convertImageDataToBitmap(front, size, size);
                        Resources.textures["skybox_back"] = Util.convertImageDataToBitmap(back, size, size);
                        Resources.textures["skybox_right"] = Util.convertImageDataToBitmap(right, size, size);
                        Resources.textures["skybox_left"] = Util.convertImageDataToBitmap(left, size, size);
                        Constants.loadedResources++;
                        return;
                    }

                    image = this.tmpGfx.getImageData(0, 0, imageWidth, imageHeight);
                    image = Util.convertImageDataToBitmap(image, imageWidth, imageHeight);

                    Resources.textures[key] = image;
                    Constants.loadedResources++;
                }
            }
        }

        this.frameCounterElement = document.getElementById("frame_counter");

        Constants.WIDTH = Constants.WIDTH / Constants.SCALE;
        Constants.HEIGHT = Constants.HEIGHT / Constants.SCALE;

        this.camera = new Camera();
        this.renderer = new Renderer(Constants.WIDTH, Constants.HEIGHT, this.camera);
        this.game = new Game(this.renderer, this.camera);

        let sample = new Bitmap(64, 64);
        for (let i = 0; i < 64 * 64; i++)
        {
            const x = i % 64;
            const y = Util.int(i / 64);
            sample.pixels[i] = (((x << 6) % 0xff) << 8) | (y << 6) % 0xff;
        }
        Resources.textures["sample0"] = sample;

        sample = new Bitmap(64, 64);
        sample.clear(0xff00ff);
        Resources.textures["sample1"] = sample;

        sample = new Bitmap(64, 64);
        sample.clear(0xffffff);
        Resources.textures["white"] = sample;

        sample = new Bitmap(64, 64);
        sample.clear(0x8080ff);
        Resources.textures["default_normal"] = sample;

        Input.init(this);
    }

    run()
    {
        const now = performance.now();
        
        while (this.times.length > 0 && this.times[0] <= now - 1000)
            this.times.shift();

        let delta = 1.0;
        if (this.times.length > 0)
            delta = (now - this.times[this.times.length - 1]) / 1000.0;

        this.times.push(now);
        this.fps = this.times.length;
        this.frameCounterElement.innerHTML = this.fps + "fps";

        if (!this.started && Constants.loadedResources == Constants.resourceReady)
        {
            this.started = true;
            this.cvs.setAttribute("width", Constants.WIDTH * Constants.SCALE + "px");
            this.cvs.setAttribute("height", Constants.HEIGHT * Constants.SCALE + "px");
            this.tmpCvs.setAttribute("width", Constants.WIDTH * Constants.SCALE + "px");
            this.tmpCvs.setAttribute("height", Constants.HEIGHT * Constants.SCALE + "px");
            this.gfx.font = "48px verdana";
        }

        if (!this.started)
        {
            this.gfx.clearRect(0, 0, this.cvs.width, this.cvs.height);
            this.gfx.fillText("Loading..." + Util.int(Constants.loadedResources / Constants.resourceReady * 100) + "%", 10, 60);
        }

        if (this.started && !Constants.pause)
        {
            this.update(delta);
            this.render();
            this.time += delta;
        }
        else if (Constants.pause)
        {
            this.gfx.fillText("PAUSE", 4, 40);
        }

        requestAnimationFrame(this.run.bind(this));
    }

    update(delta)
    {
        this.game.update(delta);
        Input.update();
    }

    render()
    {
        this.renderer.clear(0x808080);
        this.game.render();
        postProcess(this.renderer, this.postprocessEnabled);

        if (true)
        {
            this.tmpGfx.putImageData(Util.convertBitmapToImageData(this.renderer), 0, 0);
            this.gfx.save();
            this.gfx.imageSmoothingEnabled = false;
            this.gfx.scale(Constants.SCALE, Constants.SCALE);
            this.gfx.drawImage(this.tmpCvs, 0, 0);
            this.gfx.restore();
        } else
        {
            this.gfx.putImageData(Util.convertBitmapToImageData(this.renderer, Constants.SCALE), 0, 0)
        }
    }
}