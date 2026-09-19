# AeroFleet Drone Logistics App

A lightweight browser-based drone logistics dashboard for dispatching deliveries, monitoring drone battery and availability, and tracking active/completed missions.

## Features

- Fleet overview with available, in-flight, maintenance, and battery metrics.
- Mission scheduler for pickup hub, drop-off zone, payload, and priority.
- Automatic best-drone assignment based on availability and battery level.
- Delivery queue filters for all, active, and completed missions.
- Local storage persistence so fleet and mission state survives refreshes.

## Run locally

Open `index.html` directly in a browser, or serve the folder with any static file server:

```bash
python3 -m http.server 8000 --directory drone-logistics-app
```

Then visit `http://localhost:8000`.
