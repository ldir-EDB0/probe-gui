// sharedState.js

const state = {
  workbook: null,
  currentFile: null,
  interfaceMap: {},
  profiles: {},
  probes: [],
  groups: []
};

module.exports = {
  get: (key) => state[key],
  set: (key, value) => { state[key] = value; },
  getAll: () => ({ ...state }),
  setAll: (newState) => {
    Object.assign(state, newState);
  }
};
