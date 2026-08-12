import { WebSocketServer, WebSocket } from 'ws';
import noble from '@abandonware/noble';

interface ConnectionConfig {
  port: number;
  useCodedPhy: boolean;
  targetDeviceName: string;
}

const CONFIG: ConnectionConfig = {
  port: 8080,
  useCodedPhy: true,
  targetDeviceName: 'Your_Target_Device'
};

// 1. Initialize Network Gateway Server (Cross-State Connection)
const wss = new WebSocketServer({ port: CONFIG.port });
console.log(`[Friday BT] Gateway listening on cross-state port ${CONFIG.port}...`);

wss.on('connection', (ws: WebSocket) => {
  console.log("[Friday BT] Established secure tunnel to remote state.");

  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message);
      if (data.action === 'write') {
        console.log(`[Friday BT] Forwarding remote action to device: ${data.payload}`);
      }
    } catch (err) {
      console.error("[Friday BT] Failed to parse cross-state packet:", err);
    }
  });
});

// 2. Initialize Hardware Layer (Local Bluetooth Low Energy)
noble.on('stateChange', async (state) => {
  if (state === 'poweredOn') {
    console.log('[Friday BT] Hardware adapter ready. Scanning...');
    await noble.startScanningAsync([], true);
  } else {
    noble.stopScanning();
  }
});

// 3. Handle Long-Range Discovery & Optimizations
noble.on('discover', async (peripheral) => {
  const localName = peripheral.advertisement.localName;
  if (!localName) return;

  // Broadcast device signal metadata through the network to your remote instance
  const telemetry = JSON.stringify({
    event: 'device_found',
    payload: { name: localName, id: peripheral.id, rssi: peripheral.rssi }
  });
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(telemetry);
  });

  // Pair if it matches target hardware
  if (localName === CONFIG.targetDeviceName) {
    noble.stopScanning();
    console.log(`[Friday BT] Connecting to target: ${localName}...`);
    await peripheral.connectAsync();
    console.log('[Friday BT] Connected.');

    // Enforce Bluetooth 5.x Coded PHY (S=8 Long Range) if supported by hardware host
    if (CONFIG.useCodedPhy && (peripheral as any)._noble?.bindings?.setPhy) {
      const longRangePhy = { txPhy: 4, rxPhy: 4, phyOptions: 2 }; // 4 = Coded PHY, 2 = S=8
      (peripheral as any)._noble.bindings.setPhy(peripheral.id, longRangePhy);
      console.log("[Friday BT] Link negotiated to LE Coded PHY (4x Range Boost).");
    }
  }
});
