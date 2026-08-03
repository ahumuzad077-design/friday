const initialDrones = [
  { id: 'AF-101', model: 'Falcon X8', range: 38, battery: 92, status: 'available' },
  { id: 'AF-204', model: 'Swift Med', range: 24, battery: 76, status: 'available' },
  { id: 'AF-317', model: 'CargoLift', range: 52, battery: 64, status: 'available' },
  { id: 'AF-422', model: 'Harbor Hawk', range: 31, battery: 28, status: 'maintenance' }
];

class DroneLogisticsApp {
  constructor() {
    this.storageKey = 'aerofleet_drone_logistics';
    this.state = this.loadState();
    this.filter = 'all';
    this.bindEvents();
    this.render();
  }

  loadState() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) return JSON.parse(saved);
    return { drones: initialDrones, missions: [] };
  }

  saveState() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.state));
  }

  bindEvents() {
    document.getElementById('missionForm').addEventListener('submit', event => {
      event.preventDefault();
      this.dispatchMission();
    });

    document.getElementById('rechargeAll').addEventListener('click', () => {
      this.state.drones = this.state.drones.map(drone => drone.status === 'available' ? { ...drone, battery: 100 } : drone);
      this.saveState();
      this.render();
    });

    document.querySelectorAll('.filter').forEach(button => {
      button.addEventListener('click', () => {
        this.filter = button.dataset.filter;
        document.querySelectorAll('.filter').forEach(item => item.classList.toggle('active', item === button));
        this.renderMissions();
      });
    });
  }

  dispatchMission() {
    const payload = Number(document.getElementById('payload').value);
    const available = this.state.drones
      .filter(drone => drone.status === 'available' && drone.battery > 35)
      .sort((a, b) => b.battery - a.battery)[0];

    if (!available) {
      alert('No available drone has enough battery for dispatch. Recharge idle drones or clear maintenance.');
      return;
    }

    const mission = {
      id: Date.now(),
      pickup: document.getElementById('pickup').value.trim(),
      dropoff: document.getElementById('dropoff').value.trim(),
      payload,
      priority: document.getElementById('priority').value,
      droneId: available.id,
      eta: this.calculateEta(payload, available.range),
      status: 'active',
      createdAt: new Date().toLocaleString()
    };

    this.state.missions.unshift(mission);
    this.state.drones = this.state.drones.map(drone => drone.id === available.id ? { ...drone, status: 'in-flight', battery: Math.max(12, drone.battery - 18) } : drone);
    document.getElementById('missionForm').reset();
    document.getElementById('payload').value = 2.5;
    this.saveState();
    this.render();
  }

  calculateEta(payload, range) {
    const baseMinutes = 14 + payload * 3 + (60 - range) * 0.35;
    return `${Math.max(12, Math.round(baseMinutes))} min`;
  }

  completeMission(id) {
    const mission = this.state.missions.find(item => item.id === id);
    if (!mission) return;
    mission.status = 'completed';
    mission.completedAt = new Date().toLocaleString();
    this.state.drones = this.state.drones.map(drone => drone.id === mission.droneId ? { ...drone, status: 'available' } : drone);
    this.saveState();
    this.render();
  }

  render() {
    this.renderStats();
    this.renderFleet();
    this.renderMissions();
  }

  renderStats() {
    const drones = this.state.drones;
    document.getElementById('totalDrones').textContent = drones.length;
    document.getElementById('availableDrones').textContent = drones.filter(drone => drone.status === 'available').length;
    document.getElementById('inFlightDrones').textContent = drones.filter(drone => drone.status === 'in-flight').length;
    document.getElementById('avgBattery').textContent = `${Math.round(drones.reduce((sum, drone) => sum + drone.battery, 0) / drones.length)}%`;
    document.getElementById('activeRoutes').textContent = this.state.missions.filter(mission => mission.status === 'active').length;
  }

  renderFleet() {
    document.getElementById('fleetList').innerHTML = this.state.drones.map(drone => `
      <article class="drone">
        <header><strong>${drone.id} · ${drone.model}</strong><span class="badge ${drone.status}">${drone.status}</span></header>
        <div class="battery" aria-label="${drone.battery}% battery"><span style="width:${drone.battery}%"></span></div>
        <div class="meta"><span>${drone.battery}% battery</span><span>${drone.range} km range</span></div>
      </article>
    `).join('');
  }

  renderMissions() {
    const missions = this.state.missions.filter(mission => this.filter === 'all' || mission.status === this.filter);
    document.getElementById('missionList').innerHTML = missions.length ? missions.map(mission => `
      <article class="mission">
        <header><strong>${mission.pickup} → ${mission.dropoff}</strong><span class="badge ${mission.priority}">${mission.priority}</span></header>
        <div class="meta"><span>Drone ${mission.droneId}</span><span>${mission.payload} kg payload</span><span>ETA ${mission.eta}</span><span>${mission.createdAt}</span></div>
        <button ${mission.status === 'completed' ? 'disabled' : ''} onclick="app.completeMission(${mission.id})">${mission.status === 'completed' ? 'Delivered' : 'Mark delivered'}</button>
      </article>
    `).join('') : '<div class="empty">No missions match this view. Schedule a delivery to start flying.</div>';
  }
}

const app = new DroneLogisticsApp();
