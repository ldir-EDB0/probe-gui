const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { parseWorkbook } = require('./excelParser');
const { pushSelected, generateAll } = require('./pushEngine');

ipcMain.handle('push-selected', async (_e, args) => {
  const { workbook, probe, groups, interfaceMap, profiles } = args;
  try {
    const msg = await pushSelected(workbook, probe, groups, interfaceMap, profiles);
    return { ok: true, msg };
  } catch (err) {
    return { ok: false, msg: err.message };
  }
});


ipcMain.handle('generate-all', async (_e, args) => {
  const {workbook, probes, groups, interfaceMap, profiles} = args;

  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });

  if (canceled || !filePaths[0]) {
    return { ok: false, msg: 'Output directory not selected.' };
  }

  const outputDir = filePaths[0];

  try {
    const msg = await generateAll(workbook, probes, groups, interfaceMap, profiles, outputDir);
    return { ok: true, msg };
  } catch (err) {
    return { ok: false, msg: err.message };
  }
});


ipcMain.handle('parse-excel', async (_event, filePath) => {
  try {
    const parsed = parseWorkbook(filePath);
    return parsed;
  } catch (err) {
    console.error('Error parsing Excel:', err);
    return { error: err.message };
  }
});

// Handle file dialog from renderer
ipcMain.handle('select-excel-file', async () => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('renderer.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


