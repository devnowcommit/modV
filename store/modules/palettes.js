import Vue from 'vue';
import { modV } from 'modv';

const state = {
  palettes: {},
};

// getters
const getters = {
  allPalettes: state => state.palettes,
};

// actions
const actions = {
  createPalette({ commit, state }, {
    id,
    colors,
    duration,
    moduleName,
    returnFormat,
    variable,
  }) {
    return new Promise((resolve) => {
      if (id in state.palettes === true) resolve(state.palettes[id]);

      let colorsPassed = [];
      let durationPassed = 300;

      if (colors) colorsPassed = colors;
      if (duration) durationPassed = duration;

      modV.workers.palette.createPalette(id, colorsPassed, durationPassed, returnFormat);
      commit('addPalette', {
        id,
        colors,
        duration,
        moduleName,
        variable,
        returnFormat,
      });
      resolve(state.palettes[id]);
    });
  },
  removePalette({ commit }, { id }) {
    modV.workers.palette.removePalette(id);
    commit('removePalette', { id });
  },
  updateBpm({}, { bpm }) { //eslint-disable-line
    Object.keys(state.palettes).forEach((id) => {
      modV.workers.palette.setPalette(id, {
        bpm,
      });
    });
  },
  updateColors({ commit }, { id, colors }) {
    modV.workers.palette.setPalette(id, {
      colors,
    });

    commit('updateColors', { id, colors });
  },
  updateDuration({ commit }, { id, duration }) {
    commit('updateDuration', { id, duration });

    modV.workers.palette.setPalette(id, {
      timePeriod: duration,
    });
  },
  updateUseBpm({ commit }, { id, useBpm }) {
    modV.workers.palette.setPalette(id, {
      useBpm,
    });

    commit('updateUseBpm', { id, useBpm });
  },
  updateBpmDivision({ commit }, { id, bpmDivision }) {
    modV.workers.palette.setPalette(id, {
      bpmDivision,
    });

    commit('updateBpmDivision', { id, bpmDivision });
  },
  stepUpdate({ commit }, { id, currentStep, currentColor }) {
    if (!(id in state.palettes)) return;

    commit('updatePalette', {
      id,
      props: {
        currentStep,
        currentColor,
      },
    });
  },
  presetData({ state }, modulesToGet) {
    const data = {};

    Object.keys(state.palettes).forEach((key) => {
      const paletteData = state.palettes[key];
      if (modulesToGet.includes(paletteData.moduleName)) {
        data[key] = paletteData;
      }
    });

    return data;
  },
};

// mutations
const mutations = {
  addPalette(state, {
    id,
    colors,
    duration,
    useBpm,
    bpmDivision,
    moduleName,
    variable,
  }) {
    if (id in state.palettes === false) {
      Vue.set(state.palettes, id, {
        bpmDivision: bpmDivision || 16,
        duration: duration || 500,
        useBpm: useBpm || false,
        moduleName,
        colors,
        variable,
        currentColor: 0,
        currentStep: '',
      });
    }
  },
  removePalette(state, { id }) {
    Vue.delete(state.palettes, id);
  },
  updatePalette(state, { id, props }) {
    Object.keys(props).forEach(key => Vue.set(state.palettes[id], key, props[key]));
  },
  updateColors(state, { id, colors }) {
    if (id in state.palettes) {
      Vue.set(state.palettes[id], 'colors', colors);
    }
  },
  updateDuration(state, { id, duration }) {
    if (id in state.palettes) {
      Vue.set(state.palettes[id], 'duration', duration);
    }
  },
  updateUseBpm(state, { id, useBpm }) {
    if (id in state.palettes) {
      Vue.set(state.palettes[id], 'useBpm', useBpm);
    }
  },
  updateBpmDivision(state, { id, bpmDivision }) {
    if (id in state.palettes) {
      Vue.set(state.palettes[id], 'bpmDivision', bpmDivision);
    }
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
