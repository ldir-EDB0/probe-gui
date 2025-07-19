const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectExcelFile: () => ipcRenderer.invoke('select-excel-file'),
  parseExcelFile: (filePath) =>
    ipcRenderer.invoke('parse-excel', filePath),
  pushSelected: (workbook, probe, groups, interfaceMap, profiles) =>
    ipcRenderer.invoke('push-selected', {
      workbook,
      probe,
      groups,
      interfaceMap,
      profiles
    }),
  generateAll: (workbook, probes, groups, interfaceMap, profiles) =>
    ipcRenderer.invoke('generate-all', {
      workbook,
      probes,
      groups,
      interfaceMap,
      profiles,
    }),
});

