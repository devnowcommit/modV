/* eslint-env worker */

import Palette from './Palette';
import { forIn } from '../utils';

let paletteRaf;
const palettes = new Map();
self.palettes = palettes;

function createPalette(colors, duration, id) {
  const pal = new Palette(colors, duration, id);
  palettes.set(id, pal);
  postMessage({
    message: 'palette-create',
    paletteId: pal.getId(),
  });
}

function setPalette(id, data) {
  const pal = palettes.get(id);

  forIn(data, (key, item) => {
    pal[key] = item;
  });

  palettes.set(id, pal);
}

function removePalette(id) {
  palettes.delete(id);
}

function loop() {
  paletteRaf = requestAnimationFrame(loop);
  palettes.forEach((palette) => {
    palette.update().then((step) => {
      postMessage({
        message: 'palette-update',
        paletteId: palette.getId(),
        currentStep: step,
        currentColor: palette.currentColor,
      });
    });
  });
}

onmessage = function onmessage(e) {
  if (!('message' in e.data)) return;

  if (e.data.message === 'create-palette') {
    createPalette(e.data.colors, e.data.duration, e.data.paletteId, e.data.returnFormat);
  }

  if (e.data.message === 'set-palette') {
    setPalette(e.data.paletteId, e.data.options);
  }

  if (e.data.message === 'remove-palette') {
    removePalette(e.data.paletteId);
  }

  if (e.data.message === 'stop-loop') {
    paletteRaf = cancelAnimationFrame(paletteRaf);
    paletteRaf = false;
  }

  if (e.data.message === 'start-loop') {
    if (!paletteRaf) paletteRaf = requestAnimationFrame(loop);
  }
};

if (!paletteRaf) paletteRaf = requestAnimationFrame(loop);
