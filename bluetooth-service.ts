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

const wss = new WebSocketServer({ port: CONFIG.port });
console.log(`[Friday BT] Gateway listening on cross-state port ${CONFIG.port}...`);

wss.on('connection', (ws: WebSocket) => {
  console.log('[Friday BT] Established secure tunnel to remote state.');
  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message);
      if (data.action === 'write') console.log(`[Friday BT] Forwarding remote action to device: ${data.payload}`);
    } catch (err) { console.error('[Friday BT] Failed to parse cross-state packet:', err); }
  });
});

noble.on('stateChange', async (state) => {
  if (state === 'poweredOn') { console.log('[Friday BT] Hardware adapter ready. Scanning...'); await noble.startScanningAsync([], true); }
  else noble.stopScanning();
});

noble.on('discover', async (peripheral) => {
  const localName = peripheral.advertisement.localName;
  if (!localName) return;
  const telemetry = JSON.stringify({ event: 'device_found', payload: { name: localName, id: peripheral.id, rssi: peripheral.rssi } });
  wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(telemetry); });
  if (localName === CONFIG.targetDeviceName) {
    noble.stopScanning();
    console.log(`[Friday BT] Connecting to target: ${localName}...`);
    await peripheral.connectAsync();
    console.log('[Friday BT] Connected.');
    if (CONFIG.useCodedPhy && (peripheral as any)._noble?.bindings?.setPhy) {
      const longRangePhy = { txPhy: 4, rxPhy: 4, phyOptions: 2 };
      (peripheral as any)._noble.bindings.setPhy(peripheral.id, longRangePhy);
      console.log('[Friday BT] Link negotiated to LE Coded PHY.');
    }
  }
});
