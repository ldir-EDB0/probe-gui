
const { BrowserWindow } = require('electron');

function logToRenderer(level, msg) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('log-message', level, msg);
}

module.exports = {
  info: (msg) => logToRenderer('info', msg),
  warn: (msg) => logToRenderer('warn', msg),
  error: (msg) => logToRenderer('error', msg)
};
