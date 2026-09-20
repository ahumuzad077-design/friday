import { heartbeat } from "./engine.js";

const intervalMs = Number(process.env.ORBITA_HEARTBEAT_MS || 300000);

export function startWorker() {
  heartbeat();
  console.log(`[ORBITA] Background worker active; heartbeat every ${intervalMs}ms`);
  return setInterval(() => {
    try {
      heartbeat();
    } catch (error) {
      console.error("[ORBITA] Worker error:", error.message);
    }
  }, intervalMs);
}
