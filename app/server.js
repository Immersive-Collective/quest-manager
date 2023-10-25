const express = require('express');
const app = express();
const port = 1111;
const { exec } = require('child_process');

// Execute a shell command and return its output.
function executeCommand(command, callback) {
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return callback(error, null);
        }

        if (stderr) {
            console.error(`stderr: ${stderr}`);
            return callback(new Error(stderr), null);
        }

        callback(null, stdout);
    });
}

// Extract the device identifiers from the 'adb devices' command output and differentiate them.
function getDevicesList(data) {
    const lines = data.trim().split('\n').slice(1); // remove the header line
    const devices = {
        usb: [],
        wifi: [],
    };

    for (const line of lines) {
        if (line.includes('\tdevice')) {
            const [id] = line.split('\t');

            // Check if the ID format is an IP address, indicating a Wi-Fi connection.
            if (id.includes(':')) {
                devices.wifi.push(id);
            } else {
                devices.usb.push(id);
            }
        }
    }

    return devices;
}

app.get('/devices', (req, res) => {
    executeCommand('adb devices', (error, deviceListOutput) => {
        if (error) {
            return res.send(`Error: ${error.message}`);
        }

        const devices = getDevicesList(deviceListOutput);

        let responseText = '';
        if (devices.usb.length === 0 && devices.wifi.length === 0) {
            responseText = 'No devices connected.';
        } else {
            const connectPromises = []; // This array will store promises for device connection attempts.

            if (devices.usb.length > 0) {
                responseText += 'USB Devices connected:\n';

                // For each USB-connected device, attempt to switch to Wi-Fi connection.
                devices.usb.forEach(device => {
                    responseText += `- ${device}\n`;

                    // This function returns a promise that resolves when the connection attempt is complete.
                    const connectWiFi = new Promise((resolve) => {
                        // Restart the ADB server to resolve 'unauthorized'/'offline' device status issues.
                        executeCommand('adb kill-server && adb start-server', (error) => {
                            if (error) {
                                console.log(`Failed to restart ADB server: ${error.message}`);
                                resolve();
                                return;
                            }

                            // Switching to TCP/IP mode on the specified port.
                            executeCommand(`adb -s ${device} tcpip 5555`, (error) => {
                                if (error) {
                                    console.log(`Failed to switch ${device} to TCP/IP: ${error.message}`);
                                    resolve();
                                    return;
                                }

                                // Attempt to get the device's IP address. Using a different approach to ensure compatibility.
                                executeCommand(`adb -s ${device} shell ip -f inet addr show wlan0 | grep -Po 'inet \\K[\\d.]+'`, (error, ip) => {
                                    if (error || !ip) {
                                        console.log(`Failed to retrieve IP address for ${device}: ${error ? error.message : 'No IP address'}`);
                                        resolve();
                                        return;
                                    }

                                    ip = ip.trim();
                                    if (!ip) {
                                        console.log(`No IP address returned for device ${device}.`);
                                        resolve();
                                        return;
                                    }

                                    // Connect to the device over Wi-Fi
                                    executeCommand(`adb connect ${ip}:5555`, (error) => {
                                        if (error) {
                                            console.log(`Failed to connect to ${device} at ${ip}:5555 over Wi-Fi: ${error.message}`);
                                        } else {
                                            console.log(`Device ${device} switched to Wi-Fi connection at ${ip}:5555.`);
                                        }
                                        resolve();
                                    });
                                });
                            });
                        });
                    });;

                    connectPromises.push(connectWiFi);
                });
            }

            if (devices.wifi.length > 0) {
                responseText += 'Wi-Fi Devices connected:\n';
                devices.wifi.forEach(device => {
                    responseText += `- ${device}\n`;
                });
            }

            // We wait for all connection attempts to complete before sending the response.
            Promise.all(connectPromises).then(() => {
                res.send(responseText);
            });
        }
    });
});

app.use(express.static('public')); // Serving static files for your UI

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
