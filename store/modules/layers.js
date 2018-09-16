import Vue from 'vue';
import { Layer } from '@/modv';
import store from '@/../store';
import getNextName from '@/utils/get-next-name';

const state = {
  focusedLayer: 0,
  layers: [],
};

// getters
const getters = {
  allLayers: state => state.layers,
  focusedLayerIndex: state => state.focusedLayer,
  focusedLayer: state => state.layers[state.focusedLayer],
  layerFromModuleName: state => ({ moduleName }) => {
    const layerIndex = state.layers.findIndex(layer => layer.moduleOrder.indexOf(moduleName) > -1);

    if (layerIndex < 0) return false;

    return {
      layer: state.layers[layerIndex],
      layerIndex,
    };
  },
};

// actions
const actions = {
  addLayer({ commit, state }) {
    return new Promise(async (resolve) => {
      const layerName = await getNextName(
        'Layer',
        state.layers.map(layer => layer.name),
      );

      const layer = Layer({
        name: layerName,
      });

      const width = store.getters['size/width'];
      const height = store.getters['size/height'];
      let dpr = 1;
      if (store.getters['user/useRetina']) {
        dpr = window.devicePixelRatio;
      }

      layer.resize({ width, height, dpr });
      commit('addLayer', { layer });
      commit('setLayerFocus', {
        LayerIndex: state.layers.length - 1,
      });

      resolve({
        Layer: layer,
        index: state.layers.length - 1,
      });
    });
  },
  removeFocusedLayer({ commit, state }) {
    const Layer = state.layers[state.focusedLayer];
    Layer.moduleOrder.forEach((moduleName) => {
      store.dispatch(
        'modVModules/removeActiveModule',
        { moduleName },
      );
    });
    commit('removeLayer', { layerIndex: state.focusedLayer });
    if (state.focusedLayer > 0) commit('setLayerFocus', { LayerIndex: state.focusedLayer - 1 });
  },
  toggleLocked({ commit, state }, { layerIndex }) {
    const Layer = state.layers[layerIndex];

    if (Layer.locked) commit('unlock', { layerIndex });
    else commit('lock', { layerIndex });
  },
  toggleCollapsed({ commit, state }, { layerIndex }) {
    const Layer = state.layers[layerIndex];

    if (Layer.collapsed) commit('uncollapse', { layerIndex });
    else commit('collapse', { layerIndex });
  },
  addModuleToLayer({ commit }, { module, layerIndex, position }) {
    let positionShadow = position;
    if (typeof positionShadow !== 'number') {
      if (positionShadow < 0) {
        positionShadow = 0;
      }
    }
    commit('addModuleToLayer', {
      moduleName: module.meta.name,
      position: positionShadow,
      layerIndex,
    });

    store.commit(
      'modVModules/setModuleFocus',
      { activeModuleName: module.meta.name },
      { root: true },
    );
  },
  updateModuleOrder({ commit }, { layerIndex, order }) {
    commit('updateModuleOrder', { layerIndex, order });
  },
  resize(/* { state }, { width, height, dpr } */) {
    // state.layers.forEach((Layer) => {
    //   Layer.resize({ width, height, dpr });
    // });
  },
  removeAllLayers({ commit, state }) {
    state.layers.forEach((Layer, layerIndex) => {
      Layer.moduleOrder.forEach((moduleName) => {
        store.dispatch(
          'modVModules/removeActiveModule',
          { moduleName },
        );
      });

      commit('removeLayer', { layerIndex });
    });
  },
  presetData({ state }) {
    return state.layers.map((Layer) => {
      const layerData = {};
      layerData.alpha = Layer.alpha;
      layerData.blending = Layer.blending;
      layerData.clearing = Layer.clearing;
      layerData.collapsed = Layer.collapsed;
      layerData.drawToOutput = Layer.drawToOutput;
      layerData.enabled = Layer.enabled;
      layerData.inherit = Layer.inherit;
      layerData.inheritFrom = Layer.inheritFrom;
      layerData.locked = Layer.locked;
      layerData.moduleOrder = Layer.moduleOrder;
      layerData.name = Layer.name;
      layerData.pipeline = Layer.pipeline;
      return layerData;
    });
  },
  async setLayerName({ state, commit }, { layerIndex, name }) {
    const layerName = await getNextName(
      name,
      state.layers.map(layer => layer.name),
    );

    commit('setLayerName', { LayerIndex: layerIndex, name: layerName });
  },
};

// mutations
const mutations = {
  addModuleToLayer(state, { moduleName, layerIndex, position }) {
    const Layer = state.layers[layerIndex];
    if (Layer.locked) return;

    if (!Layer) {
      throw `Cannot find Layer with index ${layerIndex}`; //eslint-disable-line
    } else {
      Layer.moduleOrder.splice(position, 0, moduleName);
    }
  },
  removeModuleFromLayer(state, { moduleName, layerIndex }) {
    const Layer = state.layers[layerIndex];

    const moduleIndex = Layer.moduleOrder.indexOf(moduleName);
    if (moduleIndex < 0) return;

    Layer.moduleOrder.splice(moduleIndex, 1);
    Vue.delete(Layer.modules, moduleName);
  },
  addLayer(state, { layer }) {
    state.layers.push(layer);
  },
  removeLayer(state, { layerIndex }) {
    state.layers.splice(layerIndex, 1);
  },
  setLayerName(state, { LayerIndex, name }) {
    state.layers[LayerIndex].name = name;
  },
  setLayerFocus(state, { LayerIndex }) {
    Vue.set(state, 'focusedLayer', LayerIndex);
  },
  lock(state, { layerIndex }) {
    const Layer = state.layers[layerIndex];
    Vue.set(Layer, 'locked', true);
  },
  unlock(state, { layerIndex }) {
    const Layer = state.layers[layerIndex];
    Vue.set(Layer, 'locked', false);
  },
  setLocked(state, { layerIndex, locked }) {
    const Layer = state.layers[layerIndex];
    Vue.set(Layer, 'locked', locked);
  },
  collapse(state, { layerIndex }) {
    const Layer = state.layers[layerIndex];
    Vue.set(Layer, 'collapsed', true);
  },
  uncollapse(state, { layerIndex }) {
    const Layer = state.layers[layerIndex];
    Vue.set(Layer, 'collapsed', false);
  },
  setCollapsed(state, { layerIndex, collapsed }) {
    const Layer = state.layers[layerIndex];
    Vue.set(Layer, 'collapsed', collapsed);
  },
  updateLayers(state, { layers }) {
    state.layers = layers;
  },
  updateModuleOrder(state, { layerIndex, order }) {
    const Layer = state.layers[layerIndex];
    Vue.set(Layer, 'moduleOrder', order);
  },
  setClearing(state, { layerIndex, clearing }) {
    const Layer = state.layers[layerIndex];
    Vue.set(Layer, 'clearing', clearing);
  },
  setAlpha(state, { layerIndex, alpha }) {
    const Layer = state.layers[layerIndex];
    Vue.set(Layer, 'alpha', alpha);
  },
  setEnabled(state, { layerIndex, enabled }) {
    const Layer = state.layers[layerIndex];
    Vue.set(Layer, 'enabled', enabled);
  },
  setInherit(state, { layerIndex, inherit }) {
    const Layer = state.layers[layerIndex];
    Vue.set(Layer, 'inherit', inherit);
  },
  setInheritFrom(state, { layerIndex, inheritFrom }) {
    const Layer = state.layers[layerIndex];
    Vue.set(Layer, 'inheritFrom', inheritFrom);
  },
  setPipeline(state, { layerIndex, pipeline }) {
    const Layer = state.layers[layerIndex];
    Vue.set(Layer, 'pipeline', pipeline);
  },
  setBlending(state, { layerIndex, blending }) {
    const Layer = state.layers[layerIndex];
    Vue.set(Layer, 'blending', blending);
  },
  setDrawToOutput(state, { layerIndex, drawToOutput }) {
    const Layer = state.layers[layerIndex];
    Vue.set(Layer, 'drawToOutput', drawToOutput);
  },
  setModuleOrder(state, { layerIndex, moduleOrder }) {
    const Layer = state.layers[layerIndex];
    Vue.set(Layer, 'moduleOrder', moduleOrder);
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
