const fs = require('fs');
const path = require('path');
const express = require('express');
const { exec } = require('child_process');
const app = express();
const port = 2222;


app.use(express.json());

function getDeviceFiles(deviceId, callback) {
    // Today's date in YYYYMMDD format
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // Command to list files in the specific directory on the device
    // Unfortunately, we cannot directly get the creation date of files in Android's shell
    // So we will list all files and filter in the Node.js environment
    const command = `adb -s ${deviceId} shell ls -l /sdcard/Oculus/VideoShots/ | awk '{print $NF}'`;

    exec(command, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error fetching files for device ${deviceId}:`, stderr);
            callback([]); // Callback with an empty array on error
            return;
        }

        // The command result (stdout) will be a string with one filename per line
        // Split it into an array of filenames
        const allFiles = stdout.trim().split('\n');

        // Filter files to find those that include today's date based on filename pattern
        const todaysFiles = allFiles.filter(filename => filename.includes(today));

        callback(todaysFiles);
    });
}

function downloadFile(deviceId, remoteFilePath, localFilePath, callback) {
    const command = `adb -s ${deviceId} pull "${remoteFilePath}" "${localFilePath}"`;
    exec(command, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error downloading file: ${stderr}`);
            callback(err);
        } else {
            console.log(`Downloaded file to ${localFilePath}`);
            callback(null);
        }
    });
}



// Function to parse battery data from text to JSON
function parseBatteryData(batteryData) {
    // Split by new lines
    const lines = batteryData.split('\n');

    // Construct object
    const batteryObject = {};
    lines.forEach((line) => {
        // Split by colon to separate keys and values
        const parts = line.split(':');

        if (parts.length === 2) { // Check if the line contains a key-value pair
            const key = parts[0].trim().replace(/ /g, '_'); // Remove spaces from key, replacing with underscores
            const value = parts[1].trim();

            // Try converting string "true"/"false" to boolean, "number" to number, or keep as is for "string"
            if (value === "true" || value === "false") {
                batteryObject[key] = value === "true";
            } else if (!isNaN(value)) {
                batteryObject[key] = Number(value);
            } else {
                batteryObject[key] = value;
            }
        }
    });

    return batteryObject;
}



// Set for keeping track of connected devices
const connectedDevices = new Set();

function getDevices(callback) {
    exec('adb devices', (err, stdout, stderr) => {
        if (err) {
            console.error('Error fetching devices:', stderr);
            return;
        }

        // Process the adb devices result
        const devices = [];
        const lines = stdout.trim().split('\n');
        
        // Remove the "List of devices attached" header
        lines.shift(); 

        const deviceDetailsPromises = [];

        lines.forEach((line) => {
            const parts = line.split('\t');
            const deviceId = parts[0];
            const status = parts[1];

            const device = {
                id: deviceId,
                status: status
            };

            // Fetch additional details like model
            const getModelPromise = new Promise((resolve) => {
                const command = `adb -s ${deviceId} shell getprop ro.product.model`;
                exec(command, (err, stdout, stderr) => {
                    if (!err) {
                        device.model = stdout.trim();
                    }
                    resolve();
                });
            });

            // Fetch battery details
            const getBatteryPromise = new Promise((resolve) => {
                const command = `adb -s ${deviceId} shell dumpsys battery`;
                exec(command, (err, stdout, stderr) => {
                    if (!err) {
                        // parse the battery information here, simplified for brevity
                        // device.battery = stdout.trim(); // You might want to parse and format the output
                        device.battery = parseBatteryData(stdout.trim());
                    }
                    resolve();
                });
            });


            deviceDetailsPromises.push(getModelPromise);
            devices.push(device);
        });

        // When all additional detail commands have completed, return the devices list
        Promise.all(deviceDetailsPromises).then(() => {
            callback(devices);
        });
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


app.get('/device-files', (req, res) => {
    // The device ID is expected to be passed as a query parameter
    const deviceId = req.query.deviceId;

    if (!deviceId) {
        return res.status(400).send('Device ID is required');
    }

    getDeviceFiles(deviceId, (files) => {
        res.json(files);
    });
});


app.get('/play', (req, res) => {
    const videoName = req.query.video;

    if (!videoName) {
        return res.status(400).send('Video name is required');
    }

    res.send(`
        <!DOCTYPE html>
        <html>
        <body>

        <video width="100%" controls>
            <source src="/videos/${encodeURIComponent(videoName)}" type="video/mp4">
            Your browser does not support the video tag.
        </video>

        </body>
        </html>
    `);
});

app.get('/video', function(req, res) {
  const { deviceId, fileName } = req.query;

  if (!deviceId || !fileName) {
    return res.status(400).send('Device ID and fileName are required');
  }

  // Construct the path to your video file here. The video files seem to be synced to a local 'videos' folder.
  const videoPath = path.join(__dirname, 'public', 'videos', fileName); // Adjust the path if your structure is different.

  // Check if file exists before trying to serve it
  if (fs.existsSync(videoPath)) {
    // Serve the video file with the proper MIME type
    res.sendFile(videoPath, {
      headers: {
        'Content-Type': 'video/mp4',
      },
    });
  } else {
    // If the file doesn't exist, return a 404.
    res.status(404).send('Video not found');
  }
});


app.post('/sync', (req, res) => {

     console.log(req.body);

   const deviceId = req.body.deviceId;

    if (!deviceId) {
        // If 'deviceId' is not present, send an error response.
        return res.status(400).send('Device ID is required');
    }     

    // Adjust the local directory to the public path
    const localDir = path.join(__dirname, 'public', 'videos');

    // Create the 'videos' directory if it doesn't exist
    if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir);
    }

    // Create the downloads directory if it doesn't exist
    if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir);
    }

    getDeviceFiles(deviceId, (files) => {
        if (!files.length) {
            return res.send('No files to download.');
        }

        // Download each file if it doesn't exist locally
        files.forEach(file => {
            const localFilePath = path.join(localDir, file);
            if (!fs.existsSync(localFilePath)) {
                const remoteFilePath = `/sdcard/Oculus/VideoShots/${file}`;
                downloadFile(deviceId, remoteFilePath, localFilePath, (err) => {
                    if (err) {
                        return res.status(500).send(err.message);
                    }
                });
            } else {
                console.log(`${file} already exists locally.`);
            }
        });

        res.send('Sync complete.');
    });
});


app.use(express.static('public'));

app.use('/images', express.static('public/images'));


// Trigger the device connection refresh every 5 seconds
setInterval(refreshDeviceConnections, 5000);

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
