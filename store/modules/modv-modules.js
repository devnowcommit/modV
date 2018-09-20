import Vue from 'vue';
import Ajv from 'ajv/lib/ajv';
import { modV } from '@/modv';
import cloneDeep from 'lodash.clonedeep';
import getNextName from '@/utils/get-next-name';
import { setup as shaderSetup } from '@/modv/renderers/shader';
import { setup as isfSetup } from '@/modv/renderers/isf';
import textureResolve from '@/modv/texture-resolve';
import store from '../index';

const jsd4 = require('ajv/lib/refs/json-schema-draft-04.json');

const makeSchema = function makeSchema(properties) {
  return {
    $schema: 'http://json-schema.org/draft-04/schema#',
    type: 'object',
    properties,
  };
};

const outerState = {
  registry: {},
  active: {},
};

window.outerState = outerState;

const state = {
  registry: {},
  active: {},
  activePropQueue: {},
  activeMetaQueue: {},
  focusedModule: null,
  currentDragged: null,
};

// getters
const getters = {
  focusedModule: state => outerState.active[state.focusedModule],
  focusedModuleName: state => state.focusedModule,
  currentDragged: state => state.currentDragged,
  registry: state => state.registry,
  active: state => state.active,
  outerRegistry: () => outerState.registry,
  outerActive: () => outerState.active,
};

// actions
const actions = {
  register({ commit }, data) {
    commit('addModuleToRegistry', { name: data.meta.name, data });
  },

  async createActiveModule({ commit, state }, { moduleName, appendToName, skipInit, enabled }) {
    return new Promise(async (resolve) => {
      const existingModuleData = outerState.registry[moduleName];
      if (!existingModuleData) return;

      let newModuleData = cloneDeep(existingModuleData);

      switch (newModuleData.meta.type) {
        case 'shader':
          newModuleData = await shaderSetup(newModuleData);
          break;

        case 'isf':
          newModuleData = isfSetup(newModuleData);
          break;

        default:
          break;
      }

      newModuleData.meta.originalName = newModuleData.meta.name;
      newModuleData.meta.name = await getNextName(
        `${newModuleData.meta.name}${appendToName || ''}`,
        Object.keys(state.active),
      );
      newModuleData.meta.alpha = 1;
      newModuleData.meta.enabled = enabled || false;
      newModuleData.meta.compositeOperation = 'normal';

      const { data, props, meta, presets } = newModuleData;

      if (data) {
        Object.keys(data).forEach((key) => {
          const value = data[key];
          newModuleData[key] = value;
        });
      }

      if (props) {
        Object.keys(props).forEach((key) => {
          const value = props[key];

          if (typeof value.default !== 'undefined') {
            newModuleData[key] = value.default;
          }

          if (value.type === 'group') {
            newModuleData[key] = {};

            newModuleData[key].length = value.default > -1 ? value.default : 1;
            newModuleData[key].props = {};

            Object.keys(value.props).forEach((groupProp) => {
              const groupValue = value.props[groupProp];
              newModuleData[key].props[groupProp] = [];

              if (value.default && typeof groupValue.default !== 'undefined') {
                for (let i = 0; i < value.default; i += 1) {
                  newModuleData[key].props[groupProp][i] = groupValue.default;
                }
              }
            });
          }

          if (value.control) {
            if (value.control.type === 'paletteControl') {
              const { options } = value.control;

              store.dispatch('palettes/createPalette', {
                id: `${meta.name}-${key}`,
                colors: options.colors || [],
                duration: options.duration,
                returnFormat: options.returnFormat,
                moduleName: meta.name,
                variable: key,
              });
            }
          }
        });
      }

      if (presets) {
        newModuleData.presets = {};

        Object.keys(presets).forEach((key) => {
          const value = presets[key];
          newModuleData.presets[key] = value;
        });
      }

      commit('addModuleToActive', { name: newModuleData.meta.name, data: newModuleData });

      const canvas = modV.bufferCanvas;

      if ('audioFeatures' in newModuleData.meta) {
        if (Array.isArray(newModuleData.meta.audioFeatures)) {
          newModuleData.meta.audioFeatures.forEach(feature =>
            store.commit('meyda/addFeature', { feature }),
          );
        }
      }

      if (newModuleData.meta.name.indexOf('-gallery') > -1) {
        if ('init' in newModuleData && !skipInit) {
          newModuleData.init({ canvas });
        }

        if ('resize' in newModuleData && !skipInit) {
          newModuleData.resize({ canvas });
        }
      }

      resolve(outerState.active[newModuleData.meta.name]);
    });
  },

  removeActiveModule({ state, commit }, { moduleName }) {
    return new Promise(async (resolve) => {
      store.commit('controlPanels/unpinPanel', { moduleName });

      if (state.focusedModule === moduleName) {
        commit('setModuleFocus', { activeModuleName: null });
      }

      const module = state.active[moduleName];

      const { props, meta } = module;

      if (props) {
        Object.keys(props).forEach(async (key) => {
          const value = props[key];

          if (value.control && value.control.type === 'paletteControl') {
            await store.dispatch('palettes/removePalette', {
              id: `${meta.name}-${key}`,
            });
          }
        });
      }

      // if ('controls' in Module.info) {
      //   Object.keys(Module.info.controls).forEach((key) => {
      //     const control = Module.info.controls[key];
      //     const inputId = `${moduleName}-${control.variable}`;

      //     if (control.type === 'paletteControl') {
      //       store.dispatch('palettes/removePalette', {
      //         id: inputId,
      //       });
      //     }
      //   });
      // }

      /* Remove active module from Layers */
      const layer = store.getters['layers/layerFromModuleName']({ moduleName });
      if (layer) {
        const moduleOrder = layer.layer.moduleOrder;
        moduleOrder.splice(moduleOrder.indexOf(moduleName), 1);

        await store.dispatch('layers/updateModuleOrder', {
          layerIndex: layer.layerIndex,
          order: moduleOrder,
        });
      }

      commit('removeActiveModule', { moduleName });
      resolve();
    });
  },

  updateProp({ state, commit }, { name, prop, data, group, groupName }) {
    let propData = state.active[name].props[prop];
    const currentValue = state.active[name][prop];

    if (group || groupName) {
      propData = state.active[name].props[groupName].props[prop];
    }

    if (data === currentValue) return;

    let dataOut = data;

    store.getters['plugins/enabledPlugins']
      .filter(plugin => ('processValue' in plugin.plugin))
      .forEach((plugin) => {
        const newValue = plugin.plugin.processValue({
          currentValue: data,
          controlVariable: prop,
          delta: modV.delta,
          moduleName: name,
        });

        if (typeof newValue !== 'undefined') dataOut = newValue;
      });

    if (!Array.isArray(dataOut)) {
      const {
        strict,
        min,
        max,
        abs,
        type,
      } = propData;

      if (
        strict &&
        typeof min !== 'undefined' &&
        typeof max !== 'undefined'
      ) {
        dataOut = Math.min(Math.max(dataOut, min), max);
      }

      if (abs) {
        dataOut = Math.abs(dataOut);
      }

      if (type === 'int') {
        dataOut = Math.round(dataOut);
      }
    }

    commit('queuePropUpdate', {
      name,
      prop,
      data: {
        value: dataOut,
        type: propData.type,
        group,
        groupName,
      },
    });
  },

  syncPropQueue({ state, commit }) {
    const moduleKeys = Object.keys(state.activePropQueue);

    for (let i = 0; i < moduleKeys.length; i += 1) {
      const moduleKey = moduleKeys[i];
      const moduleProps = state.activePropQueue[moduleKey];

      const propsKeys = Object.keys(moduleProps);

      for (let j = 0; j < moduleKeys.length; j += 1) {
        const key = propsKeys[j];

        if (
          typeof moduleProps[key] === 'undefined' ||
          typeof key === 'undefined'
        ) {
          /* eslint-disable no-continue */
          continue;
        }

        if (!outerState.active[moduleKey]) continue;

        const { group, groupName } = moduleProps[key];

        if (group || groupName) {
          if ('set' in outerState.active[moduleKey].props[groupName].props[key]) {
            outerState
              .active[moduleKey].props[groupName].props[key]
              .set.bind(outerState.active[moduleKey])(moduleProps[key].value);
          }
        } else if ('set' in outerState.active[moduleKey].props[key]) {
          outerState
            .active[moduleKey]
            .props[key].set.bind(outerState.active[moduleKey])(moduleProps[key].value);
        }

        commit('updateProp', {
          name: moduleKey,
          prop: key,
          data: moduleProps[key],
          group,
          groupName,
        });
      }
    }
  },

  updateMeta({ commit }, args) {
    commit('queueMetaUpdate', args);
  },

  syncMetaQueue({ state, commit }) {
    const moduleKeys = Object.keys(state.activeMetaQueue);

    for (let i = 0; i < moduleKeys.length; i += 1) {
      const moduleKey = moduleKeys[i];
      const moduleMetaValues = state.activeMetaQueue[moduleKey];

      const metaKeys = Object.keys(moduleMetaValues);

      for (let j = 0; j < moduleKeys.length; j += 1) {
        const key = metaKeys[j];
        if (
          typeof moduleMetaValues[key] === 'undefined' ||
          typeof key === 'undefined'
        ) {
          /* eslint-disable no-continue */
          continue;
        }

        commit('updateMeta', {
          name: moduleKey,
          metaKey: key,
          data: moduleMetaValues[key],
        });
      }
    }
  },

  syncQueues({ dispatch }) {
    dispatch('syncPropQueue');
    dispatch('syncMetaQueue');
  },

  resetModule({ dispatch }, { name }) {
    Object.keys(outerState.registry[name].props).forEach((key) => {
      const prop = outerState.registry[name].props[key];

      dispatch('updateProp', {
        name,
        prop: key,
        data: prop.default,
      });
    });
  },

  presetData({ state }) {
    // @TODO: figure out a better clone than JSONparse(JSONstringify())
    const ajv = new Ajv({
      removeAdditional: 'all',
    });
    ajv.addMetaSchema(jsd4);

    const moduleNames = Object.keys(state.active)
      .filter(key => key.substring(key.length - 8, key.length) !== '-gallery');

    const moduleData = moduleNames.reduce((obj, moduleName) => {
      obj[moduleName] = {};
      obj[moduleName].values = Object.keys(state.active[moduleName].props)
        .reduce((valuesObj, prop) => {
          valuesObj[prop] = state.active[moduleName][prop];
          return valuesObj;
        }, {});
      return obj;
    }, {});

    moduleNames.forEach((moduleName) => {
      const Module = outerState.active[moduleName];

      // Merge Module data onto existing data
      moduleData[moduleName].meta = {};
      moduleData[moduleName].meta = Object.assign(Module.meta, moduleData[moduleName].meta);

      if (!('saveData' in Module.meta)) {
        /* eslint-disable no-console */
        console.warn(
          `generatePreset: Module ${Module.meta.name} has no saveData schema, falling back to Vuex store data`,
        );
        return;
      }

      const schema = makeSchema(JSON.parse(JSON.stringify(Module.meta.saveData)));
      const validate = ajv.compile(schema);

      const copiedModule = JSON.parse(JSON.stringify(Module));
      const validated = validate(copiedModule);
      if (!validated) {
        console.error(
          `generatePreset: Module ${Module.meta.name} failed saveData validation, skipping`,
          validate.errors,
        );
        /* eslint-enable no-console */
        return;
      }

      // Merge validated data onto existing data
      moduleData[moduleName].values = Object.assign(moduleData[moduleName].values, copiedModule);
    });

    return moduleData;
  },

  setActiveModuleInfo({ commit }, { moduleName, key, value }) {
    commit('setActiveModuleInfo', { moduleName, key, value });
  },
};

// mutations
const mutations = {
  addModuleToRegistry(state, { name, data }) {
    outerState.registry[name] = data;
    Vue.set(state.registry, name, data);
  },

  addModuleToActive(state, { name, data }) {
    outerState.active[name] = data;
    Vue.set(state.active, name, JSON.parse(JSON.stringify(data)));
  },

  removeModuleFromRegistry(state, { moduleName }) {
    Vue.delete(state.registry, moduleName);
  },

  queuePropUpdate(state, { name, prop, data }) {
    if (typeof state.activePropQueue[name] === 'undefined') {
      Vue.set(state.activePropQueue, name, {});
    }

    Vue.set(state.activePropQueue[name], prop, data);
  },

  updateProp(state, { name, prop, data, group, groupName }) {
    let value;

    if (data.type === 'texture') {
      value = textureResolve(data.value);
    } else {
      value = data.value;
    }

    if (typeof group === 'number') {
      outerState.active[name][groupName].props[prop][group] = value;
      Vue.set(state.active[name][groupName].props[prop], group, value);
    } else {
      outerState.active[name][prop] = value;
      Vue.set(state.active[name], prop, value);
    }

    Vue.delete(state.activePropQueue[name], prop);
  },

  queueMetaUpdate(state, { name, metaKey, data }) {
    if (typeof state.activeMetaQueue[name] === 'undefined') {
      Vue.set(state.activeMetaQueue, name, {});
    }

    Vue.set(state.activeMetaQueue[name], metaKey, data);
  },

  updateMeta(state, { name, metaKey, data }) {
    outerState.active[name].meta[metaKey] = data;
    Vue.set(state.active[name].meta, metaKey, data);
    Vue.delete(state.activeMetaQueue[name], metaKey);
  },

  // setActiveModuleControlValue(state, { moduleName, variable, value, processedValue }) {
  //   Vue.set(state.active[moduleName], variable, value);
  //   externalState.active[moduleName][variable] = processedValue || value;
  // },

  removeActiveModule(state, { moduleName }) {
    delete outerState.active[moduleName];
    Vue.delete(state.active, moduleName);
  },

  setModuleFocus(state, { activeModuleName }) {
    state.focusedModule = activeModuleName;
  },

  setCurrentDragged(state, { moduleName }) {
    state.currentDragged = moduleName;
  },

  setActiveModuleAlpha(state, { moduleName, alpha }) {
    outerState.active[moduleName].meta.alpha = alpha;
    Vue.set(state.active[moduleName].meta, 'alpha', alpha);
  },

  setActiveModuleEnabled(state, { moduleName, enabled }) {
    outerState.active[moduleName].meta.enabled = enabled;
    Vue.set(state.active[moduleName].meta, 'enabled', enabled);
  },

  setActiveModuleCompositeOperation(state, { moduleName, compositeOperation }) {
    outerState.active[moduleName].meta.compositeOperation = compositeOperation;
    Vue.set(state.active[moduleName].meta, 'compositeOperation', compositeOperation);
  },

  setActiveModuleMeta(state, { moduleName, key, value }) {
    outerState.active[moduleName].meta[key] = value;
    Vue.set(state.active[moduleName].meta, key, value);
  },

  incrementGroup(state, { moduleName, groupName }) {
    const { props, length } = outerState.active[moduleName][groupName];

    Object.keys(props).forEach((prop) => {
      const defaultValue = state.active[moduleName].props[groupName].props[prop].default;

      outerState.active[moduleName][groupName].props[prop][length] = defaultValue;
      Vue.set(state.active[moduleName][groupName].props[prop], length, defaultValue);
    });

    outerState.active[moduleName][groupName].length = length + 1;
    Vue.set(state.active[moduleName][groupName], 'length', length + 1);
  },

  decrementGroup(state, { moduleName, groupName }) {
    const { props, length } = outerState.active[moduleName][groupName];

    Object.keys(props).forEach((prop) => {
      delete outerState.active[moduleName][groupName].props[prop][length - 1];
      Vue.delete(state.active[moduleName][groupName].props[prop], length - 1);
    });

    outerState.active[moduleName][groupName].length = length - 1;
    Vue.set(state.active[moduleName][groupName], 'length', length - 1);
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
