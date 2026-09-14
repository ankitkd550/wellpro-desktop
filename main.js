// This is Electron's "main process" - it creates app windows
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow(hash) {
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  if (hash) {
    win.loadFile('index.html', { hash: hash });
  } else {
    win.loadFile('index.html');
  }
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

// Listens for a request from a renderer window to open a new, separate window
// focused on one specific screen (e.g. Billing, Inventory)
ipcMain.on('open-window', (event, page) => {
  createWindow(page);
});