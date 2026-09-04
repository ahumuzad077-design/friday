// ===========================================================================
// F.R.I.D.A.Y. IRON MAN STYLE - Web UI with Voice & Dashboard
// Like JARVIS from Iron Man - Visual, Voice-Enabled, Always Ready
// ===========================================================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { FridayCommandCenter } = require('./friday-command-center');

class FridayIronManInterface {
    constructor(port = 3000) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.friday = new FridayCommandCenter();
        this.wss = new WebSocket.Server({ server: this.server });
        this.clients = [];
        
        this.setupExpress();
        this.setupWebSocket();
        this.setupAPI();
    }
    
    setupExpress() {
        this.app.use(express.static('public'));
        this.app.use(express.json());
        
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });
    }
    
    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            this.clients.push(ws);
            
            // Send initial status
            ws.send(JSON.stringify({
                type: 'status',
                data: this.getSystemStatus()
            }));
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleCommand(data, ws);
                } catch (e) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid command' }));
                }
            });
            
            ws.on('close', () => {
                this.clients = this.clients.filter(c => c !== ws);
            });
        });
        
        // Send metrics updates every second
        setInterval(() => {
            this.broadcastUpdate({
                type: 'metrics',
                data: this.getSystemStatus()
            });
        }, 1000);
    }
    
    setupAPI() {
        this.app.post('/api/decision', (req, res) => {
            const { situation } = req.body;
            const decision = this.friday.decisionEngine.makeAutonomousDecision(situation);
            const patterns = this.friday.neuralPatterns.findSimilarPatterns(situation);
            
            res.json({
                decision,
                patterns: patterns.length,
                confidence: this.friday.skills.getSkillProficiency('decision-making').confidence
            });
        });
        
        this.app.post('/api/task', (req, res) => {
            const { name, frequency } = req.body;
            const taskId = this.friday.taskFramework.createTaskTemplate(name, { frequency });
            
            res.json({ taskId, status: 'created' });
        });
        
        this.app.post('/api/agent', (req, res) => {
            const { name, capabilities } = req.body;
            const agentId = this.friday.agentCoordinator.spawnAgent(name, capabilities);
            
            res.json({ agentId, status: 'deployed' });
        });
        
        this.app.get('/api/status', (req, res) => {
            res.json(this.getSystemStatus());
        });
        
        this.app.get('/api/skills', (req, res) => {
            res.json(this.friday.skills.listSkills());
        });
        
        this.app.post('/api/voice-command', (req, res) => {
            const { transcript } = req.body;
            
            // Process voice command like regular command
            const commandLower = transcript.toLowerCase();
            let action = 'general';
            let params = {};
            
            if (commandLower.includes('decision') || commandLower.includes('decide')) {
                action = 'decision';
                params.situation = transcript;
            } else if (commandLower.includes('task') || commandLower.includes('create')) {
                action = 'task';
                params.name = transcript.replace(/task|create/i, '').trim();
                params.frequency = 'hourly';
            } else if (commandLower.includes('agent') || commandLower.includes('deploy')) {
                action = 'agent';
                params.name = transcript.replace(/agent|deploy/i, '').trim();
                params.capabilities = ['task-execution', 'monitoring'];
            } else if (commandLower.includes('status')) {
                return res.json({ type: 'status', data: this.getSystemStatus() });
            }
            
            res.json({ 
                received: transcript,
                action,
                processing: true,
                message: `Processing: ${transcript}`
            });
        });
        
        this.app.post('/api/speak', (req, res) => {
            const { text } = req.body;
            
            // Text-to-speech response
            const lines = text.split('\n');
            const ssmlText = lines.map(line => `<speak>${line}</speak>`).join('');
            
            res.json({
                type: 'speech',
                text,
                ssml: ssmlText,
                audio: true
            });
        });
    }
    
    handleCommand(data, ws) {
        const { action, params } = data;
        
        try {
            let response = {};
            
            if (action === 'decision') {
                response = {
                    type: 'decision_response',
                    decision: this.friday.decisionEngine.makeAutonomousDecision(params.situation),
                    confidence: this.friday.skills.getSkillProficiency('decision-making').confidence
                };
            } else if (action === 'task') {
                response = {
                    type: 'task_created',
                    taskId: this.friday.taskFramework.createTaskTemplate(params.name, { frequency: params.frequency })
                };
            } else if (action === 'agent') {
                response = {
                    type: 'agent_deployed',
                    agentId: this.friday.agentCoordinator.spawnAgent(params.name, params.capabilities)
                };
            } else if (action === 'status') {
                response = {
                    type: 'status',
                    data: this.getSystemStatus()
                };
            }
            
            ws.send(JSON.stringify(response));
            this.broadcastUpdate(response);
        } catch (error) {
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
    }
    
    getSystemStatus() {
        const m = this.friday.memory.memory;
        const skills = this.friday.skills.listSkills();
        const avgSkill = Object.values(skills).reduce((s, sk) => s + sk.level, 0) / 7;
        
        return {
            tasksCompleted: m.operationalMetrics.tasksCompleted,
            decisionsAuto: m.operationalMetrics.decisionsAuto,
            improvizedSolutions: m.operationalMetrics.improvizedSolutions,
            learningEvents: m.learningEvents.length,
            activeAgents: Object.keys(this.friday.agentCoordinator.agents).length,
            taskTemplates: Object.keys(this.friday.taskFramework.tasks).length,
            patterns: Object.keys(this.friday.neuralPatterns.patterns).length,
            capabilities: this.friday.expansionEngine.capabilities.length,
            avgSkillLevel: avgSkill,
            adaptationSpeed: this.friday.realtimeAdapter.metrics.adaptationSpeed
        };
    }
    
    broadcastUpdate(data) {
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }
    
    start() {
        this.server.listen(this.port, () => {
            console.log('\n╔════════════════════════════════════════════════════════════╗');
            console.log('║                                                            ║');
            console.log('║        🚀 F.R.I.D.A.Y. IRON MAN INTERFACE ACTIVE 🚀       ║');
            console.log('║                                                            ║');
            console.log(`║  Web Interface:  http://localhost:${this.port}                       ║`);
            console.log('║  Mode:           Voice & Visual Dashboard                  ║');
            console.log('║  Status:         Ready for commands                        ║');
            console.log('║                                                            ║');
            console.log('║  Open your browser and experience FRIDAY like Iron Man! 🤖 ║');
            console.log('║                                                            ║');
            console.log('╚════════════════════════════════════════════════════════════╝\n');
        });
    }
}

if (require.main === module) {
    const friday = new FridayIronManInterface(3000);
    friday.start();
}

module.exports = { FridayIronManInterface };
