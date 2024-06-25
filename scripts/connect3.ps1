# Define color codes
$RED = "`e[0;31m"
$GREEN = "`e[0;32m"
$YELLOW = "`e[0;33m"
$BLUE = "`e[0;34m"
$NC = "`e[0m" # No Color

# Function to get the device IP address
function Get-DeviceIP {
    param (
        [string]$device
    )
    adb -s $device shell ip route | ForEach-Object { $_ -match '(\d+\.\d+\.\d+\.\d+)' | Out-Null; $matches[0] }
}

# Function to print a line with a clear
function Print-Line {
    param (
        [string]$message
    )
    Write-Host "$message"
}

# Function to check for device and connect via Wi-Fi
function Connect-ViaWiFi {
    Clear-Host
    Print-Line "${BLUE}Checking for existing Wi-Fi connections...${NC}"
    $existingDevices = adb devices | Select-String -Pattern '5555' | ForEach-Object { $_.ToString().Split("`t")[0] }
    
    if ($existingDevices) {
        Print-Line "${GREEN}Existing Wi-Fi connections:${NC}"
        $existingDevices | ForEach-Object { Print-Line $_ }
    } else {
        Print-Line "${YELLOW}No existing Wi-Fi connections found.${NC}"
    }

    Print-Line "${BLUE}Checking for connected devices via USB...${NC}"
    $usbDevice = adb devices | Select-String -Pattern 'device' | Select-String -NotMatch '5555' | ForEach-Object { $_.ToString().Split("`t")[0] }

    if ($usbDevice) {
        Print-Line "${GREEN}Device found: $usbDevice${NC}"
        Print-Line "${BLUE}Restarting ADB in TCP mode on port 5555...${NC}"
        adb -s $usbDevice tcpip 5555

        Print-Line "${BLUE}Determining IP address of the device...${NC}"
        Start-Sleep -Seconds 2  # Give the device some time to switch to TCP mode
        $ip = Get-DeviceIP -device $usbDevice

        if ($ip) {
            Print-Line "${GREEN}Device IP address: $ip${NC}"
            Print-Line "${BLUE}Connecting to the device via Wi-Fi...${NC}"
            adb connect "$ip:5555"

            if (adb devices | Select-String -Pattern "$ip:5555") {
                Print-Line "${GREEN}Successfully connected to the device via Wi-Fi: $ip:5555${NC}"
            } else {
                Print-Line "${RED}Failed to connect to the device via Wi-Fi.${NC}"
            }
        } else {
            Print-Line "${RED}Unable to determine the IP address of the device.${NC}"
        }
    } else {
        Print-Line "${YELLOW}No USB device found. Retrying...${NC}"
    }
}

# Clear the screen initially
Clear-Host

# Watch loop to continuously check for USB connection
Print-Line "${BLUE}Starting ADB Auto Connect Watcher...${NC}"
while ($true) {
    Connect-ViaWiFi
    Start-Sleep -Seconds 10
}
