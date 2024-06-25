#!/bin/bash

# Define color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to get the device IP address
get_device_ip() {
    adb -s "$1" shell ip route | awk '{print $9}'
}

# Function to print a line with a clear
print_line() {
    tput el
    echo -e "$1"
}

# Function to check for device and connect via Wi-Fi
connect_via_wifi() {
    tput cup 0 0
    print_line "${BLUE}Checking for existing Wi-Fi connections...${NC}"
    existing_devices=$(adb devices | grep -w '5555' | awk '{print $1}')
    
    if [ -n "$existing_devices" ]; then
        print_line "${GREEN}Existing Wi-Fi connections:${NC}"
        print_line "$existing_devices"
    else
        print_line "${YELLOW}No existing Wi-Fi connections found.${NC}"
    fi

    print_line "${BLUE}Checking for connected devices via USB...${NC}"
    usb_device=$(adb devices | grep -w 'device' | grep -v '5555' | awk '{print $1}')

    if [ -n "$usb_device" ]; then
        print_line "${GREEN}Device found: $usb_device${NC}"
        print_line "${BLUE}Restarting ADB in TCP mode on port 5555...${NC}"
        adb -s "$usb_device" tcpip 5555

        print_line "${BLUE}Determining IP address of the device...${NC}"
        sleep 2  # Give the device some time to switch to TCP mode
        ip=$(get_device_ip "$usb_device")

        if [ -n "$ip" ]; then
            print_line "${GREEN}Device IP address: $ip${NC}"
            print_line "${BLUE}Connecting to the device via Wi-Fi...${NC}"
            adb connect "$ip:5555"

            if adb devices | grep -q "$ip:5555"; then
                print_line "${GREEN}Successfully connected to the device via Wi-Fi: $ip:5555${NC}"
            else
                print_line "${RED}Failed to connect to the device via Wi-Fi.${NC}"
            fi
        else
            print_line "${RED}Unable to determine the IP address of the device.${NC}"
        fi
    else
        print_line "${YELLOW}No USB device found. Retrying...${NC}"
    fi
}

# Clear the screen initially
clear

# Watch loop to continuously check for USB connection
echo -e "${BLUE}Starting ADB Auto Connect Watcher...${NC}"
while true; do
    connect_via_wifi
    sleep 10
done
