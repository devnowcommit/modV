// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue';
import Dropdown from 'hsy-vue-dropdown';
import Shortkey from 'vue-shortkey';
import VueThrottleEvent from 'vue-throttle-event';
import Buefy from 'buefy';
import Vuebar from 'vuebar';
import MoreMath from 'moremath';

import Capitalize from '@/vuePlugins/capitalize-filter';

import { modV } from './modv';
import App from './App';
import store from '../store';
import contextMenu from './extra/context-menu';
import expression from './extra/expression';
import midiAssignment from './extra/midi-assignment';
import featureAssignment from './extra/feature-assignment';
import lfo from './extra/lfo';
import grabCanvas from './extra/grab-canvas';
import slimUi from './extra/slim-ui';
import shadertoy from './extra/shadertoy';
import './assets/styles/index.scss';

import attachResizeHandles from './extra/ui-resize/attach';

Math = Object.assign(Math, MoreMath); //eslint-disable-line

Vue.config.productionTip = false;

Object.defineProperty(Vue.prototype, '$modV', {
  get() {
    return modV;
  },
});

Vue.use(Capitalize);

Vue.use(Vuebar);
Vue.use(Buefy, {
  defaultIconPack: 'fa',
});
Vue.use(VueThrottleEvent);
Vue.use(Dropdown);
Vue.use(Shortkey);

modV.use(contextMenu);
modV.use(featureAssignment);
modV.use(expression);
modV.use(midiAssignment);
modV.use(lfo);
modV.use(grabCanvas);
modV.use(slimUi);
modV.use(shadertoy);

/* eslint-disable no-new */
export default window.modVVue = new Vue({
  el: '#app',
  template: '<App/>',
  components: { App },
  store,
  data: {
    modV,
  },
  mounted() {
    modV.start(this);

    [
      'Text',
      'Webcam',
      'Plasma',
      'ChromaticAbberation',
      'Wobble',
      'Neon',
      'Fisheye',
      'MirrorEdge',
      'EdgeDistort',
      'Polygon',
      // 'Phyllotaxis',
      'Pixelate-2.0',
      'Ball-2.0',
      'Concentrics-2.0',
      'Waveform-2.0',
      'Un-Deux-Trois',
      'OpticalFlowDistort-2.0',
      'MattiasCRT-2.0',
    ].forEach((fileName) => {
      import(`@/modv/sample-modules/${fileName}`).then((Module) => {
        modV.register(Module.default);
      }).catch((e) => {
        throw new Error(e);
      });
    });

    [
      'film-grain.fs',
      'block-color.fs',
      'plasma.fs',
      'Random Shape.fs',
      'Triangles.fs',
      'Echo Trace.fs',
      'rgbtimeglitch.fs',
      'badtv.fs',
      'feedback.fs',
      'rgbglitchmod.fs',
      'tapestryfract.fs',
      'hexagons.fs',
      'UltimateFlame.fs',
      'CompoundWaveStudy1.fs',
      'FractilianParabolicCircleInversion.fs',
      'ASCII Art.fs',
      'CollapsingArchitecture.fs',
      'Dither-Bayer.fs',
      'GreatBallOfFire.fs',
      'VHS Glitch.fs.fs',
      'Zebre.fs',
      'st_lsfGDH.fs',
      'st_Ms2SD1.fs.fs',
      'rotozoomer.fs',
      'Kaleidoscope.fs',
      'RGB Halftone-lookaround.fs',
      'Circuits.fs',
      'BrightnessContrast.fs',
      'UltimateSpiral.fs',
      'MBOX3.fs',
      'HexVortex.fs',
      'Hue-Saturation.fs',
      'Vignette.fs',
      'v002 Crosshatch.fs',
      'Sine Warp Tile.fs',
      'RGB Trails 3.0.fs',
      'RGB Strobe.fs',
      'Kaleidoscope Tile.fs',
      'Interlace.fs',
      'Convergence.fs',
      'Collage.fs',
      'Pinch.fs',
      'Slice.fs',
      'digital-crystal-tunnel.fs',
      'film-grain.fs',
      'spherical-shader-tut.fs',
      'scale.fs',
      'LogTransWarpSpiral.fs',
    ].forEach((fileName) => {
      import(`@/modv/sample-modules/isf-samples/${fileName}`).then((fragmentShader) => {
        modV.register({
          meta: {
            name: fileName,
            author: '',
            version: '1.0.0',
            type: 'isf',
          },
          fragmentShader: fragmentShader.default,
          vertexShader: 'void main() {isf_vertShaderInit();}',
        });
      }).catch((e) => {
        throw new Error(e);
      });
    });

    attachResizeHandles();
  },
});
