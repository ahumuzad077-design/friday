import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.ORBITA_DATA_DIR || path.join(process.cwd(), "data", "orbita");
const STATE_FILE = path.join(DATA_DIR, "state.json");

const emptyState = {
  version: 1,
  project: {
    name: "C-Space",
    fundraisingEnabled: false,
    publicOfferEnabled: false
  },
  investors: [],
  tasks: [],
  approvals: [],
  activity: []
};

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(emptyState, null, 2));
  }
}

export function loadState() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return structuredClone(emptyState);
  }
}

export function saveState(state) {
  ensureStore();
  const temp = STATE_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(state, null, 2));
  fs.renameSync(temp, STATE_FILE);
}

export function mutateState(mutator) {
  const state = loadState();
  const result = mutator(state);
  saveState(state);
  return result ?? state;
}

export function logActivity(type, details = {}) {
  mutateState((state) => {
    state.activity.push({
      id: crypto.randomUUID(),
      type,
      details,
      timestamp: new Date().toISOString()
    });
    state.activity = state.activity.slice(-500);
  });
}
