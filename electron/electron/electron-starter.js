// This might be main.js or electron/electron-starter.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
// const expressApp = require('../server'); // Import the instance from your server setup
const { app: expressApp, initializeAdbPath } = require('../server');

let mainWindow;

function createWindow() {
    initializeAdbPath().then(() => {
        const server = expressApp.listen(0, () => {
            // Retrieve the actual port used
            const actualPort = server.address().port;
            console.log(`Server started on http://localhost:${actualPort}`);

            // Create the browser window.
            mainWindow = new BrowserWindow({
                width: 1280,
                height: 840,
                webPreferences: {
                    nodeIntegration: true,
                },
                title: "Quest Manager", // Your window title
                icon: path.join(__dirname, 'assets/icon.png') // path to your icon file

            });

            // and load the index.html of the app.
            mainWindow.loadURL(`http://localhost:${actualPort}`); // This should point to your Express server using the actual port

            mainWindow.on('closed', function() {
                mainWindow = null;
                // It's important to close the server when your app is closed.
                server.close();
            });

            mainWindow.webContents.openDevTools();

        });
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function() {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function() {
    if (mainWindow === null) createWindow();
});