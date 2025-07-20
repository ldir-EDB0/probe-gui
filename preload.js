const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectExcelFile: () =>
    ipcRenderer.invoke('select-excel-file'),
  parseExcelFile: (filePath) =>
    ipcRenderer.invoke('parse-excel', filePath),
  pushSelected: (probe, groups) =>
    ipcRenderer.invoke('push-selected', {
      probe,
      groups,
    }),
  generateAll: () =>
    ipcRenderer.invoke('generate-all', {
    }),
});

