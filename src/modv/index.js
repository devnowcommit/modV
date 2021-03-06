import EventEmitter2 from 'eventemitter2';
import BeatDetektor from '@/extra/beatdetektor';
import store from '@/store/';
import Layer from './Layer';
import { scan, setSource } from './MediaStream';
import draw from './draw';
import setupWebGl from './webgl';
import PaletteWorker from './palette-worker/palette-worker';
import MediaManagerClient from './MediaManagerClient';
import use from './use';

class ModV extends EventEmitter2 {
  /**
   * [constructor description]
   * @param  {ModVOptions} options
   */
  constructor() {
    super();

    this.assignmentMax = 1;

    this.layers = store.getters['layers/allLayers'];
    this.registeredModules = store.getters['modVModules/registeredModules'];
    this.activeModules = store.getters['modVModules/outerActive'];
    this.getActiveModule = store.getters['modVModules/getActiveModule'];
    this.windows = store.getters['windows/allWindows'];
    this.windowReference = store.getters['windows/windowReference'];
    this.audioFeatures = store.getters['meyda/features'];
    this.mediaStreamDevices = {
      audio: store.getters['mediaStream/audioSources'],
      video: store.getters['mediaStream/videoSources'],
    };
    this.palettes = store.getters['palettes/allPalettes'];

    this.useDetectedBpm = store.getters['tempo/detect'];
    this.bpm = store.getters['tempo/bpm'];

    this.beatDetektor = new BeatDetektor(85, 169);
    this.beatDetektorKick = new BeatDetektor.modules.vis.BassKick();
    this.kick = false;

    this.mediaStreamScan = scan.bind(this);
    this.setMediaStreamSource = setSource.bind(this);

    this.width = 200;
    this.height = 200;

    this.webgl = setupWebGl(this);

    const ISFcanvas = document.createElement('canvas');
    const ISFgl = ISFcanvas.getContext('webgl2', {
      premultipliedAlpha: false,
    });

    this.isf = {
      canvas: ISFcanvas,
      gl: ISFgl,
    };

    this.mainRaf = null;
    this.workers = {};

    window.addEventListener('unload', () => {
      this.windows.forEach((windowController) => {
        const windowRef = this.windowReference(windowController.window);
        windowRef.close();
      });
    });

    this.delta = 0;
  }

  start(Vue) {
    const mediaStreamScan = this.mediaStreamScan;
    const setMediaStreamSource = this.setMediaStreamSource;

    this.bufferCanvas = document.createElement('canvas');
    this.bufferContext = this.bufferCanvas.getContext('2d');

    this.outputCanvas = document.createElement('canvas');
    this.outputContext = this.outputCanvas.getContext('2d');

    this.previewCanvas = document.getElementById('preview-canvas');
    this.previewContext = this.previewCanvas.getContext('2d');

    this.videoStream = document.createElement('video');
    this.videoStream.autoplay = true;
    this.videoStream.muted = true;

    store.dispatch('windows/createWindow', { Vue });

    mediaStreamScan().then((mediaStreamDevices) => {
      mediaStreamDevices.audio.forEach(source => store.commit('mediaStream/addAudioSource', { source }));
      mediaStreamDevices.video.forEach(source => store.commit('mediaStream/addVideoSource', { source }));

      let audioSourceId;
      let videoSourceId;

      if (store.getters['user/currentAudioSource']) {
        audioSourceId = store.getters['user/currentAudioSource'];
      } else if (mediaStreamDevices.audio.length > 0) {
        audioSourceId = mediaStreamDevices.audio[0].deviceId;
      }

      if (store.getters['user/setCurrentVideoSource']) {
        videoSourceId = store.getters['user/setCurrentVideoSource'];
      } else if (mediaStreamDevices.video.length > 0) {
        videoSourceId = mediaStreamDevices.video[0].deviceId;
      }

      return {
        audioSourceId,
        videoSourceId,
      };
    }).then(setMediaStreamSource).then(({ audioSourceId, videoSourceId }) => {
      store.commit('user/setCurrentAudioSource', { sourceId: audioSourceId });
      store.commit('user/setCurrentVideoSource', { sourceId: videoSourceId });

      this.mainRaf = requestAnimationFrame(this.loop.bind(this));
    });

    this.workers = this.createWorkers();
    this.MediaManagerClient = new MediaManagerClient();

    store.dispatch('size/resizePreviewCanvas');
  }

  loop(δ) {
    this.delta = δ;
    let features = [];

    if (this.audioFeatures.length > 0) {
      features = this.meyda.get(this.audioFeatures);
    }

    if (features) {
      this.activeFeatures = features;

      const assignments = store.getters['meyda/controlAssignments'];
      assignments.forEach((assignment) => {
        const featureValue = features[assignment.feature];

        store.dispatch('modVModules/updateProp', {
          name: assignment.moduleName,
          prop: assignment.controlVariable,
          data: featureValue,
        });
      });

      this.beatDetektor.process((δ / 1000.0), features.complexSpectrum.real);
      this.updateBPM(this.beatDetektor.win_bpm_int_lo);
    }

    store.getters['plugins/enabledPlugins']
      .filter(plugin => ('process' in plugin.plugin))
      .forEach(plugin => plugin.plugin.process({
        delta: δ,
      }));

    this.beatDetektorKick.process(this.beatDetektor);
    this.kick = this.beatDetektorKick.isKick();

    store.dispatch('modVModules/syncQueues');

    draw(δ).then(() => {
      this.mainRaf = requestAnimationFrame(this.loop.bind(this));
    }).then(() => {
      this.emit('tick', δ);
    });
  }

  use(type, extention) { //eslint-disable-line
    use(type, extention);
  }

  addContextMenuHook(hook) { //eslint-disable-line
    store.commit('contextMenu/addHook', {
      hookName: hook.hook,
      hook,
    });
  }

  register(Module) { //eslint-disable-line
    store.dispatch('modVModules/register', Module);
  }

  resize(width, height, dpr = 1) {
    this.width = width * dpr;
    this.height = height * dpr;

    this.bufferCanvas.width = this.width;
    this.bufferCanvas.height = this.height;
    this.outputCanvas.width = this.width;
    this.outputCanvas.height = this.height;

    this.isf.canvas.width = this.width;
    this.isf.canvas.height = this.height;

    this.webgl.resize(this.width, this.height);
  }

  updateBPM(newBpm) {
    this.bpm = store.getters['tempo/bpm'];
    this.useDetectedBpm = store.getters['tempo/detect'];

    if (!newBpm || !this.useDetectedBpm) return;

    const bpm = Math.round(newBpm);
    if (this.bpm !== bpm) {
      store.dispatch('tempo/setBpm', { bpm });
    }
  }

  /** @return {WorkersDataType} */
  createWorkers() {//eslint-disable-line
    const palette = new PaletteWorker();

    return {
      palette,
    };
  }


  static get Layer() {
    return Layer;
  }
}

const modV = new ModV();

window.modV = modV;
const webgl = modV.webgl;
const isf = modV.isf;

export default modV;
export {
  modV,
  Layer,
  webgl,
  isf,
  draw,
};
