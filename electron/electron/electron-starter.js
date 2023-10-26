// This might be main.js or electron/electron-starter.js
const { app, BrowserWindow } = require('electron');
const expressApp = require('../server'); // Import the instance from your server setup

let mainWindow;

function createWindow() {
  // Start your Express server
  const server = expressApp.listen(2222, () => {
    console.log('Server started on http://localhost:2222');
  });

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL('http://localhost:2222');  // This should point to your Express server

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});
