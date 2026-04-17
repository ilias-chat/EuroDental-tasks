const { app, BrowserWindow } = require('electron');
const path = require('path');

const isDev = process.env.ELECTRON_DEV === '1';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    void win.loadURL('http://127.0.0.1:4200/');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(
      __dirname,
      '..',
      'dist',
      'tasks-app',
      'browser',
      'index.html',
    );
    void win.loadFile(indexPath);
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
