const express = require('express');
const { exec } = require('child_process');
const app = express();
const port = 2222;

// Set for keeping track of connected devices
const connectedDevices = new Set();

function getDevices(callback) {
    exec('adb devices', (err, stdout, stderr) => {
        if (err) {
            console.error('Error fetching devices:', stderr);
            return;
        }

        const devices = [];
        const lines = stdout.split('\n');
        lines.forEach((line) => {
            if (line.endsWith('\tdevice')) {
                const parts = line.split('\t');
                const device = { id: parts[0] };
                devices.push(device);
            }
        });
        callback(devices);
    });
}

function connectDeviceOverTCP(deviceId) {
    if (connectedDevices.has(deviceId)) {
        console.log(`Device ${deviceId} is already connected.`);
        return;
    }

    // Replace this with your command to obtain the device's IP address
    const commandToGetIP = `adb -s ${deviceId} shell ip route | awk '{print $9}'`;

    exec(commandToGetIP, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error fetching IP for device ${deviceId}:`, stderr);
            return;
        }

        const ip = stdout.trim(); // assuming the IP is the result of your command
        const connectCommand = `adb -s ${deviceId} tcpip 5555 && adb connect ${ip}:5555`;

        exec(connectCommand, (err, stdout, stderr) => {
            if (err) {
                console.error(`Error connecting device ${deviceId} over TCP/IP:`, stderr);
                return;
            }

            connectedDevices.add(deviceId);
            console.log(`Device ${deviceId} connected over TCP/IP with address ${ip}:5555`);
            console.log('ADB Command Output:', stdout);

            // here can we get more information to display by UI

        });
    });
}

function refreshDeviceConnections() {
    getDevices((devices) => {
        devices.forEach(device => {
            if (!connectedDevices.has(device.id)) {
                connectDeviceOverTCP(device.id);
            }
        });
    });
}

app.get('/devices', (req, res) => {
    getDevices((devices) => {
        res.json(devices);
    });
});

app.use(express.static('public'));

// Trigger the device connection refresh every 5 seconds
setInterval(refreshDeviceConnections, 5000);

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
