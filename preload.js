const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectExcelFile: () => ipcRenderer.invoke('select-excel-file'),
  parseExcelFile: (filePath) => ipcRenderer.invoke('parse-excel', filePath),
  pushSelected: (filePath, probe, groups, interfaceMap, profiles) =>
    ipcRenderer.invoke('push-selected', {
      filePath,
      probe,
      groups,
      interfaceMap,
      profiles
    }),
  generateAll: (filePath) => ipcRenderer.invoke('generate-all', filePath),

});

