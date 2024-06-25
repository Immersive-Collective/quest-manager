# Quest Web App Manager

🚀 **Simplify Your VR Workflow with a Custom Quest Web App Manager!** 🚀

## Overview

This Node.js-based Express app streamlines the management of Oculus Quest devices, providing functionalities such as file synchronization, remote operations, and device monitoring.

## Key Features

### Auto-Discovery & Connection
Automatically discovers and connects to Quest devices over TCP/IP using ADB commands.

### Battery Monitoring
Fetches and parses battery information from connected devices to provide real-time battery status.

### File Management
Lists and downloads today's video files from Quest devices, organizing them locally for easy access and management.

### Video Playback
Provides a web interface to play synced videos directly from the local server.

### Remote Recording Control
Remotely start/stop video recording and capture screenshots via ADB commands, allowing for efficient content creation and management.

### Continuous Device Refresh
Ensures all devices are continuously connected and ready for operations, refreshing connections every 5 seconds.

## Installation

1. **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/quest-web-app-manager.git
    cd quest-web-app-manager
    ```

2. **Install dependencies:**
    ```bash
    npm install
    ```

3. **Run the application:**
    ```bash
    node app.js
    ```

4. **Access the web interface:**
    Open your browser and navigate to `http://localhost:2222`.

## API Endpoints

### List Devices
```http
GET /devices
```
Fetches a list of connected devices.

### List Device Files
```http
GET /device-files?deviceId=<device-id>
```
Lists today's video files on the specified device.

### Play Video
```http
GET /play?video=<video-name>
```
Streams a video file in the browser.

### Sync Files
```http
POST /sync
Content-Type: application/json
{
  "deviceId": "<device-id>"
}
```
Downloads today's video files from the specified device.

### Toggle Recording
```http
POST /toggle-recording
Content-Type: application/json
{
  "deviceId": "<device-id>",
  "action": "start" | "stop"
}
```
Starts or stops video recording on the specified device.

### Capture Screenshot
```http
POST /capture-screenshot
Content-Type: application/json
{
  "deviceId": "<device-id>"
}
```
Captures a screenshot on the specified device.

## Code Highlights

### Device Discovery
Automatically discovers and connects to devices over TCP/IP:
```javascript
function refreshDeviceConnections() {
    getDevices((devices) => {
        devices.forEach(device => {
            if (!connectedDevices.has(device.id)) {
                connectDeviceOverTCP(device.id);
            }
        });
    });
}
```

### File Synchronization
Downloads today's video files from the device:
```javascript
app.post('/sync', async (req, res) => {
    // Implementation for synchronizing files
});
```

### Remote Operations
Controls recording and captures screenshots via ADB:
```javascript
function toggleRecording(deviceId, action) {
    // Implementation for toggling recording
}
```

## Contributing
Contributions are welcome! Please open an issue or submit a pull request.

## License
This project is licensed under the MIT License.

---

This tool is essential for VR developers and content creators, simplifying tasks and saving time. Let's keep pushing the boundaries of VR!
