# ScrewShop on your iPhone

This computer hosts the studio and saves all files. Keep it awake and connect the phone to the same trusted home Wi-Fi.

## Current addresses

- Computer: http://localhost:5050/barwork
- iPhone setup/profile: http://192.168.1.67:5050/ScrewShop.mobileconfig
- iPhone studio with microphone support: https://192.168.1.67:5443/barwork

These addresses use the computer's current Wi-Fi IP. If the router changes it, use the new address and restart ScrewShop so its certificate includes that IP. A router DHCP reservation can keep it stable.

## First connection

1. Open the ScrewShop desktop shortcut.
2. In Safari on iPhone, visit the setup/profile URL above. Download the **ScrewShop Local Connection** profile.
3. In iPhone Settings, open Profile Downloaded (or General > VPN & Device Management) and install that profile. It contains only this computer's certificate; no remote management or account is enrolled.
4. Go to Settings > General > About > Certificate Trust Settings. Enable trust for **ScrewShop Private Local CA**. Apple requires this separate trust step for manually installed profiles: [Apple certificate instructions](https://support.apple.com/en-us/102390).
5. Open the HTTPS studio URL. Enter the code from `ScrewShop/data/phone-pairing-code.txt` on the computer. This is a local pairing code, not your Supabase password.
6. In Safari's Share menu, choose Add to Home Screen. Use Open as Web App if offered. [Apple Home Screen instructions](https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios).
7. Try importing a small recording, playing it, recording a short microphone take, and reloading to confirm it was saved. Physical-device behavior has not yet been tested.

You can compare the certificate's SHA-256 fingerprint with `data/tls/fingerprint.txt` on the computer before trusting it. The private signing key stays in `data/tls/ca-key.pem`, outside the web root. Remove the ScrewShop profile from the phone if you stop using this computer as your server.

## If the phone cannot connect

The local HTTP and HTTPS servers are listening, and certificate/pairing checks passed from this computer using its Wi-Fi address. A physical phone connection is not verified.

Windows Firewall may still need to allow this app on your **Private** network. Automatic approval review blocked a combined cleanup/firewall command, so no new firewall rule was added. In Windows Security > Firewall & network protection, allow the ScrewShop Python app for Private networks, or have an administrator add an inbound rule limited to TCP ports **5050 and 5443**, **Private** profile, and **LocalSubnet** remote addresses. Do not open router/internet ports. Guest Wi-Fi may isolate devices.

Plain HTTP phone access can browse/import, but iPhone microphone access needs a trusted HTTPS connection. `localhost` on the phone refers to the phone itself, not this computer.

## What this installation does

The Home Screen icon runs the same local web app as the computer. Data stays on the computer. It does not yet provide standalone phone storage while the computer is off, App Store distribution, or cloud sync. No Supabase connector is needed for the current local-only setup.
