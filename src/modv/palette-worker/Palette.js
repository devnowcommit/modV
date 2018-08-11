function colorToRgbString(color) {
  try {
    return `rgb(${color.r},${color.g},${color.b})`;
  } catch (e) {
    return 'rgb(0,0,0)';
  }
}

function colorToRgbaString(color) {
  try {
    return `rgba(${color.r},${color.g},${color.b},1)`;
  } catch (e) {
    return 'rgba(0,0,0,1)';
  }
}

function calculateStep(colors, currentColor, currentTime, timePeriod) {
  let r1;
  let g1;
  let b1;

  try {
    r1 = colors[currentColor].r;
    g1 = colors[currentColor].g;
    b1 = colors[currentColor].b;
  } catch (e) {
    // try catch because the user may delete the
    // current color which throws the array and nextIndex out of sync
    // TODO: fix case where user deletes current color
    return [0, 0, 0];
  }

  let nextColor = currentColor + 1;

  if (nextColor > colors.length - 1) {
    nextColor = 0;
  }

  const r2 = colors[nextColor].r;
  const g2 = colors[nextColor].g;
  const b2 = colors[nextColor].b;

  const p = currentTime / (timePeriod - 1);
  const r = Math.round((1.0 - p) * r1 + p * r2 + 0.5); // eslint-disable-line
  const g = Math.round((1.0 - p) * g1 + p * g2 + 0.5); // eslint-disable-line
  const b = Math.round((1.0 - p) * b1 + p * b2 + 0.5); // eslint-disable-line

  return {
    r, g, b, a: 1,
  };
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ] : null;
}

function Palette(colorsIn, timePeriod, id, returnFormat) {
  this.bpm = 120;
  this.useBpm = false;
  this.bpmDivision = 16;
  this.creationTime = Date.now();
  this.returnFormat = returnFormat;

  const stringed = JSON.stringify(colorsIn);

  this.colors = JSON.parse(stringed) || [];
  this.timePeriod = timePeriod || 100;

  this.currentColor = 0; // jshint ignore:line
  this.currentTime = 0; // jshint ignore:line
  // this.timePeriod = Math.round((this.timePeriod/1000) * 60);

  this.getId = function getId() {
    return id;
  };
}

Palette.prototype.addColor = function addColor(color) {
  let rgbFromHex;
  if (typeof color === 'string') {
    rgbFromHex = hexToRgb(color);
    this.colors.push(rgbFromHex);
  } else if (Array.isArray(color.constructor)) {
    this.colors.push(rgbFromHex);
  } else return false;

  return this.colors.length;
};

Palette.prototype.getColors = function getColors() {
  return this.colors;
};

Palette.prototype.removeAtIndex = function removeAtIndex(index) {
  const returnVal = this.colors.splice(index, 1);
  return returnVal;
};

Palette.prototype.nextStep = function nextStep(cb) {
  if (this.useBpm) {
    // fps * 60 seconds / bpm / BpmDiv
    this.timePeriod = (((60 * 60) / this.bpm) * this.bpmDivision);
  }

  if (this.colors.length < 1) {
    // If there are no colors, return false
    return false;
  } else if (this.colors.length < 2) {
    // If there are less than two colors, just return the only color
    return colorToRgbString(this.colors[0]);
  }

  this.currentTime += (1000 / 60);

  if (this.currentTime >= this.timePeriod) {
    if (this.currentColor > this.colors.length - 2) {
      this.currentColor = 0;
    } else {
      this.currentColor += 1;
    }
    this.currentTime = 0;
  }

  const step = calculateStep(this.colors, this.currentColor, this.currentTime, this.timePeriod);
  let returned = '';

  if (this.returnFormat === 'rgbaString') {
    returned = colorToRgbaString(step);
  } else {
    returned = colorToRgbString(step);
  }

  cb(returned);
  return returned;
};

Palette.prototype.update = function update() {
  return new Promise((resolve) => {
    this.nextStep(resolve);
  });
};

Palette.prototype.setTimePeriod = function setTimePeriod() {
  // TODO: sets time period and updates current time period if old is greater than new
};

export default Palette;
