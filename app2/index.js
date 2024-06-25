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

        // Sort the files in descending order by their embedded timestamp
        todaysFiles.sort((a, b) => {
            const timeA = a.split('-')[2];
            const timeB = b.split('-')[2];
            return timeB.localeCompare(timeA); // 'timeB.localeCompare(timeA)' sorts in descending order
        });

        callback(todaysFiles);
    });
}


function downloadFile(deviceId, remoteFilePath, localFilePath) {
    return new Promise((resolve, reject) => {
        const command = `adb -s ${deviceId} pull "${remoteFilePath}" "${localFilePath}"`;
        exec(command, (err, stdout, stderr) => {
            if (err) {
                console.error(`Error downloading file: ${stderr}`);
                reject(err);  // Reject the promise in case of error
            } else {
                console.log(`Downloaded file to ${localFilePath}`);
                resolve(stdout);  // Resolve the promise successfully
            }
        });
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
app.post('/sync', async (req, res) => {
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
        fs.mkdirSync(localDir, { recursive: true }); // The 'recursive' option ensures that 'mkdir' behaves like 'mkdir -p'
    }
    try {
        // Retrieve the files from the device
        const files = await new Promise((resolve, reject) => {
            getDeviceFiles(deviceId, (files) => {
                if (files.length) {
                    resolve(files);
                } else {
                    reject(new Error('No files to download.'));
                }
            });
        });
        // Create an array of promises for file downloads
        const downloadPromises = files.map(file => {
            const localFilePath = path.join(localDir, file);
            if (!fs.existsSync(localFilePath)) {
                const remoteFilePath = `/sdcard/Oculus/VideoShots/${file}`;
                return downloadFile(deviceId, remoteFilePath, localFilePath);
            } else {
                console.log(`${file} already exists locally.`);
                return Promise.resolve();  // Return a resolved promise for existing files
            }
        });
        // Wait for all files to be downloaded
        await Promise.all(downloadPromises);
        res.send('Sync complete.');  // Send response once all files are handled
    } catch (error) {
        console.error('Error in /sync:', error);
        res.status(500).send('Internal Server Error');  // Send a 500 error for any caught exceptions
    }
});
function toggleRecording(deviceId, action) {
    return new Promise((resolve, reject) => {
        let adbCommand;
        if (action === 'start') {
            adbCommand = `adb -s ${deviceId} shell am startservice -a START_INTERNAL_CAPTURE_TO_DISK -n com.oculus.metacam/.capture.CaptureService`;
        } else if (action === 'stop') {
            adbCommand = `adb -s ${deviceId} shell am startservice -a STOP_INTERNAL_CAPTURE_TO_DISK -n com.oculus.metacam/.capture.CaptureService`;
        } else {
            reject(new Error('Invalid action specified. Use "start" or "stop".'));
            return;
        }
        exec(adbCommand, (err, stdout, stderr) => {
            if (err) {
                console.error(`Error toggling recording on device ${deviceId}:`, stderr);
                reject(err);
            } else {
                console.log(`Recording ${action}ed on device ${deviceId}`);
                resolve(stdout);
            }
        });
    });
}
app.post('/toggle-recording', async (req, res) => {
    const deviceId = req.body.deviceId;
    const action = req.body.action; // This should be either 'start' or 'stop'
    if (!deviceId || !action) {
        return res.status(400).send('Device ID and action are required');
    }
    try {
        await toggleRecording(deviceId, action);
        res.send(`Recording ${action}ed successfully`);
    } catch (error) {
        console.error('Error in /toggle-recording:', error);
        res.status(500).send('Internal Server Error');
    }
});
function captureScreenshot(deviceId) {
    return new Promise((resolve, reject) => {
        // Command to capture a screenshot
        const adbCommand = `adb -s ${deviceId} shell am startservice -a TAKE_SCREENSHOT -n com.oculus.metacam/.capture.CaptureService`;
        exec(adbCommand, (err, stdout, stderr) => {
            if (err) {
                console.error(`Error capturing screenshot on device ${deviceId}:`, stderr);
                reject(err);
            } else {
                console.log(`Screenshot taken on device ${deviceId}`);
                resolve(stdout); // this will be the command's success output
            }
        });
    });
}
app.post('/capture-screenshot', async (req, res) => {
    const deviceId = req.body.deviceId;
    if (!deviceId) {
        return res.status(400).send('Device ID is required');
    }
    try {
        await captureScreenshot(deviceId);
        res.send('Screenshot captured successfully');
    } catch (error) {
        console.error('Error in /capture-screenshot:', error);
        res.status(500).send('Internal Server Error');
    }
});
app.use(express.static('public'));
app.use('/images', express.static('public/images'));
// Trigger the device connection refresh every 5 seconds
setInterval(refreshDeviceConnections, 5000);
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});