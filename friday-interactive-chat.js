#!/usr/bin/env node

// ===========================================================================
// F.R.I.D.A.Y. INTERACTIVE CHAT WITH AUTONOMOUS AI
// Start a real conversation with your autonomous intelligence
// ===========================================================================

const readline = require('readline');
const { FridayCommandCenter } = require('./friday-command-center');

class FridayInteractiveChat {
    constructor() {
        this.friday = new FridayCommandCenter();
        this.conversationHistory = [];
        this.sessionStart = new Date();
    }
    
    start() {
        console.log('\n');
        console.log('╔══════════════════════════════════════════════════════════════════╗');
        console.log('║                                                                  ║');
        console.log('║            🚀 FRIDAY INTERACTIVE CHAT SESSION 🚀               ║');
        console.log('║                                                                  ║');
        console.log('║  I\'m Friday, your autonomous AI intelligence assistant.        ║');
        console.log('║  I learn, decide, act, and adapt - all in real-time.          ║');
        console.log('║                                                                  ║');
        console.log('║  Type anything you want:                                        ║');
        console.log('║  • Ask me to make decisions                                      ║');
        console.log('║  • Give me tasks to execute                                      ║');
        console.log('║  • Ask about my capabilities                                     ║');
        console.log('║  • Request agent spawning                                        ║');
        console.log('║  • Chat about operations                                         ║');
        console.log('║                                                                  ║');
        console.log('║  Type "exit" to end, or "help" for commands                     ║');
        console.log('║                                                                  ║');
        console.log('╚══════════════════════════════════════════════════════════════════╝\n');
        
        this.showSystemStatus();
        this.initializeChat();
    }
    
    showSystemStatus() {
        const m = this.friday.memory.memory;
        const avgSkill = Object.values(this.friday.skills.listSkills())
            .reduce((sum, s) => sum + s.level, 0) / 7;
        
        console.log('📊 SYSTEM ONLINE:');
        console.log(`   ✓ Memory: ${m.learningEvents.length} learning events`);
        console.log(`   ✓ Skills: ${avgSkill.toFixed(2)}/10 average proficiency`);
        console.log(`   ✓ Agents: ${Object.keys(this.friday.agentCoordinator.agents).length} deployed`);
        console.log(`   ✓ Patterns: ${Object.keys(this.friday.neuralPatterns.patterns).length} recognized`);
        console.log(`   ✓ Status: Ready for autonomous operations\n`);
    }
    
    initializeChat() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true
        });
        
        rl.setPrompt('You: ');
        rl.prompt();
        
        rl.on('line', (line) => {
            const userInput = line.trim();
            
            if (!userInput) {
                rl.prompt();
                return;
            }
            
            // Record conversation
            this.conversationHistory.push({
                speaker: 'user',
                message: userInput,
                time: new Date()
            });
            
            // Handle input
            this.handleUserInput(userInput);
            
            // Check for exit
            if (userInput.toLowerCase() === 'exit') {
                rl.close();
                this.endSession();
                return;
            }
            
            rl.prompt();
        });
        
        rl.on('close', () => {
            this.endSession();
        });
    }
    
    handleUserInput(input) {
        const lower = input.toLowerCase();
        
        console.log();
        
        // Commands
        if (lower === 'help' || lower === '?') {
            this.showHelp();
        }
        else if (lower === 'status' || lower === 'stats') {
            this.showDetailedStatus();
        }
        else if (lower === 'skills') {
            this.showSkillsDetailed();
        }
        else if (lower === 'agents') {
            this.showAgentsDetailed();
        }
        else if (lower === 'patterns') {
            this.showPatternsDetailed();
        }
        else if (lower === 'history') {
            this.showLearningHistory();
        }
        else if (lower === 'clear' || lower === 'cls') {
            console.clear();
            this.start();
        }
        else if (input.toLowerCase().includes('decision') || input.toLowerCase().includes('decide')) {
            this.processDecisionRequest(input);
        }
        else if (input.toLowerCase().includes('task') || input.toLowerCase().includes('create')) {
            this.processTaskRequest(input);
        }
        else if (input.toLowerCase().includes('agent') || input.toLowerCase().includes('spawn')) {
            this.processAgentRequest(input);
        }
        else if (input.toLowerCase().includes('optimize') || input.toLowerCase().includes('improve')) {
            this.processOptimizeRequest();
        }
        else {
            this.processGeneralQuery(input);
        }
        
        console.log();
    }
    
    processDecisionRequest(input) {
        console.log('Friday: Analyzing situation...\n');
        
        // Extract situation
        const situation = input
            .replace(/decision|decide|should|about|make/gi, '')
            .replace(/^[?\s]+/, '')
            .trim() || 'Current operational situation';
        
        // Make decision
        const decision = this.friday.decisionEngine.makeAutonomousDecision(situation);
        
        // Find similar patterns
        const similar = this.friday.neuralPatterns.findSimilarPatterns(situation);
        
        // Generate response
        console.log('┌─ AUTONOMOUS DECISION ─────────────────────────────┐');
        console.log(`│ Decision: ${decision.padEnd(48)}│`);
        console.log('├────────────────────────────────────────────────────┤');
        
        const skill = this.friday.skills.getSkillProficiency('decision-making');
        console.log(`│ Confidence: ${(skill.confidence * 100).toFixed(0)}% | Skill Level: ${skill.level.toFixed(2)}/10   │`);
        
        if (similar.length > 0) {
            const match = (similar[0].similarity * 100).toFixed(0);
            console.log(`│ Pattern Match: ${match}% similar to past scenario        │`);
        } else {
            console.log('│ Status: Novel scenario - generating unique solution       │');
        }
        
        console.log('└────────────────────────────────────────────────────┘');
    }
    
    processTaskRequest(input) {
        console.log('Friday: Creating task...\n');
        
        // Extract task details
        const taskMatch = input.match(/(?:to|create|add)\s+(.+?)(?:\s+every|$)/i);
        const freqMatch = input.match(/(?:every|each)\s+(\w+)/i);
        
        const taskName = taskMatch ? taskMatch[1].trim() : 'Custom Task';
        const frequency = freqMatch ? freqMatch[1].toLowerCase() : 'hourly';
        
        const taskId = this.friday.taskFramework.createTaskTemplate(taskName, { frequency });
        
        console.log('┌─ TASK CREATED ─────────────────────────────────────┐');
        console.log(`│ Task: ${taskName.padEnd(42)}│`);
        console.log(`│ Frequency: ${frequency.padEnd(38)}│`);
        console.log(`│ ID: ${taskId.padEnd(44)}│`);
        console.log('├────────────────────────────────────────────────────┤');
        console.log('│ Status: Ready for autonomous execution              │');
        console.log('│ Retries: 3 on failure                               │');
        console.log('│ Monitoring: Active                                   │');
        console.log('└────────────────────────────────────────────────────┘');
    }
    
    processAgentRequest(input) {
        console.log('Friday: Spawning agent...\n');
        
        // Extract agent details
        const nameMatch = input.match(/agent\s+(?:for|to|named?|do\s+)?\s*(.+?)(?:\s+with|$)/i);
        const capMatch = input.match(/(?:with|for)\s+(.+?)$/i);
        
        const agentName = nameMatch ? nameMatch[1].trim() : 'Autonomous Agent';
        const capabilities = capMatch ? capMatch[1].split(/[,;]/).map(c => c.trim()) : 
                            ['task-execution', 'decision-support'];
        
        const agentId = this.friday.agentCoordinator.spawnAgent(agentName, capabilities);
        
        console.log('┌─ AGENT DEPLOYED ───────────────────────────────────┐');
        console.log(`│ Name: ${agentName.padEnd(42)}│`);
        console.log(`│ ID: ${agentId.padEnd(44)}│`);
        console.log('├────────────────────────────────────────────────────┤');
        capabilities.forEach(cap => {
            console.log(`│ ✓ ${cap.padEnd(46)}│`);
        });
        console.log('├────────────────────────────────────────────────────┤');
        console.log('│ Status: Online and ready                             │');
        console.log('│ Capacity: Ready to accept tasks                      │');
        console.log('└────────────────────────────────────────────────────┘');
    }
    
    processOptimizeRequest() {
        console.log('Friday: Optimizing operations...\n');
        
        const metrics = this.friday.businessOps.optimizeResources();
        
        console.log('┌─ OPTIMIZATION RESULTS ─────────────────────────────┐');
        console.log(`│ Efficiency: ${(metrics.efficiency * 100).toFixed(1)}%${' '.repeat(35)}│`);
        console.log(`│ Cost Optimization: ${(metrics.costOptimization * 100).toFixed(1)}%${' '.repeat(28)}│`);
        console.log('├────────────────────────────────────────────────────┤');
        console.log('│ Resources reallocated for maximum efficiency        │');
        console.log('│ Continuous optimization active                      │');
        console.log('└────────────────────────────────────────────────────┘');
    }
    
    processGeneralQuery(input) {
        const responses = [
            'That\'s interesting! I\'m analyzing the implications.',
            'I\'m processing that request. Give me a moment...',
            'Understood. Let me work on that for you.',
            'I see. I\'m considering the best approach.',
            'Got it! I\'m developing a response.'
        ];
        
        const response = responses[Math.floor(Math.random() * responses.length)];
        console.log(response);
        
        this.friday.memory.recordLearning(`Chat input: ${input}`);
        
        console.log('\nTry being more specific:');
        console.log('  • "Make a decision about..."');
        console.log('  • "Create a task to..."');
        console.log('  • "Spawn an agent for..."');
        console.log('  • "status" for system info');
        console.log('  • "help" for all commands');
    }
    
    showHelp() {
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║                    FRIDAY COMMANDS                       ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║ AUTONOMY:                                                ║');
        console.log('║   "Make a decision about [situation]"                   ║');
        console.log('║   "Create a task to [action] every [time]"              ║');
        console.log('║   "Spawn an agent for [purpose]"                        ║');
        console.log('║                                                          ║');
        console.log('║ INFORMATION:                                             ║');
        console.log('║   "status" - Full system status                         ║');
        console.log('║   "skills" - Show skill proficiencies                   ║');
        console.log('║   "agents" - List active agents                         ║');
        console.log('║   "patterns" - Show learned patterns                    ║');
        console.log('║   "history" - Learning events                           ║');
        console.log('║                                                          ║');
        console.log('║ OPERATIONS:                                              ║');
        console.log('║   "optimize" - Run optimization cycle                   ║');
        console.log('║   "clear" - Clear screen                                ║');
        console.log('║                                                          ║');
        console.log('║ GENERAL:                                                 ║');
        console.log('║   "help" or "?" - Show this help                        ║');
        console.log('║   "exit" - End session                                  ║');
        console.log('║                                                          ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
    }
    
    showDetailedStatus() {
        const m = this.friday.memory.memory;
        const skills = this.friday.skills.listSkills();
        const avgLevel = Object.values(skills).reduce((s, sk) => s + sk.level, 0) / 7;
        
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║              FRIDAY SYSTEM STATUS                        ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log(`║ Tasks Completed: ${String(m.operationalMetrics.tasksCompleted).padEnd(42)}║`);
        console.log(`║ Decisions Made: ${String(m.operationalMetrics.decisionsAuto).padEnd(43)}║`);
        console.log(`║ Learning Events: ${String(m.learningEvents.length).padEnd(42)}║`);
        console.log(`║ Avg Skill Level: ${String(avgLevel.toFixed(2) + '/10').padEnd(41)}║`);
        console.log(`║ Active Agents: ${String(Object.keys(this.friday.agentCoordinator.agents).length).padEnd(44)}║`);
        console.log(`║ Pattern Count: ${String(Object.keys(this.friday.neuralPatterns.patterns).length).padEnd(44)}║`);
        console.log(`║ Adaptation Speed: ${String((this.friday.realtimeAdapter.metrics.adaptationSpeed * 100).toFixed(1) + '%').padEnd(39)}║`);
        console.log('╚══════════════════════════════════════════════════════════╝');
    }
    
    showSkillsDetailed() {
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║                  SKILL PROFICIENCY                       ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        
        const skills = this.friday.skills.listSkills();
        for (const [name, prof] of Object.entries(skills)) {
            const bar = '█'.repeat(Math.floor(prof.level)) + '░'.repeat(10 - Math.floor(prof.level));
            const emoji = prof.level < 1.5 ? '🌱' : prof.level < 2 ? '📈' : prof.level < 3 ? '⭐' : '🏆';
            console.log(`║ ${emoji} ${name.padEnd(20)} [${bar}] ${String(prof.level.toFixed(2)).padEnd(4)}`);
        }
        
        console.log('╚══════════════════════════════════════════════════════════╝');
    }
    
    showAgentsDetailed() {
        const agents = Object.values(this.friday.agentCoordinator.agents);
        
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║                  DEPLOYED AGENTS                         ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        
        if (agents.length === 0) {
            console.log('║ No agents deployed. Create one with "spawn agent for..." ║');
        } else {
            agents.forEach((agent, i) => {
                const status = this.friday.agentCoordinator.getAgentStatus(agent.id);
                console.log(`║ ${i + 1}. ${agent.name.padEnd(43)} Status: ${agent.status}`);
                console.log(`║    Tasks: ${status.tasksPending} pending | Efficiency: ${status.efficiency}`);
            });
        }
        
        console.log('╚══════════════════════════════════════════════════════════╝');
    }
    
    showPatternsDetailed() {
        const patterns = Object.values(this.friday.neuralPatterns.patterns);
        
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║                 LEARNED PATTERNS                         ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        
        if (patterns.length === 0) {
            console.log('║ No patterns learned yet. Give me more tasks!            ║');
        } else {
            patterns.slice(-5).forEach((p, i) => {
                console.log(`║ ${i + 1}. ${p.context.substring(0, 40).padEnd(40)}`);
                console.log(`║    Freq: ${String(p.frequency).padEnd(4)} | Success: ${(p.successRate * 100).toFixed(0)}%`);
            });
        }
        
        console.log('╚══════════════════════════════════════════════════════════╝');
    }
    
    showLearningHistory() {
        const events = this.friday.memory.memory.learningEvents;
        
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║                 LEARNING HISTORY                         ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        
        if (events.length === 0) {
            console.log('║ No learning events yet.                                 ║');
        } else {
            events.slice(-5).forEach((e, i) => {
                const text = e.event.substring(0, 56).padEnd(56);
                console.log(`║ ${text}║`);
            });
        }
        
        console.log('╚══════════════════════════════════════════════════════════╝');
    }
    
    endSession() {
        console.log('\n');
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║                  SESSION COMPLETE                        ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        
        const duration = Math.floor((Date.now() - this.sessionStart) / 1000);
        const m = this.friday.memory.memory;
        
        console.log(`║ Duration: ${String(duration + 's').padEnd(50)}║`);
        console.log(`║ Turns: ${String(this.conversationHistory.length).padEnd(52)}║`);
        console.log(`║ Decisions: ${String(m.operationalMetrics.decisionsAuto).padEnd(47)}║`);
        console.log(`║ Tasks: ${String(Object.keys(this.friday.taskFramework.tasks).length).padEnd(51)}║`);
        console.log(`║ Agents: ${String(Object.keys(this.friday.agentCoordinator.agents).length).padEnd(50)}║`);
        
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║ I\'ve learned from our conversation and improved.         ║');
        console.log('║ Continue with: node friday-daemon.js (24/7 operations)   ║');
        console.log('║                                                          ║');
        console.log('║               See you soon! 🚀                           ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
        
        this.friday.memory.recordLearning(`Chat session: ${this.conversationHistory.length} turns`);
        this.friday.memory.saveMemory();
        
        process.exit(0);
    }
}

// ==================== START ====================
if (require.main === module) {
    const chat = new FridayInteractiveChat();
    chat.start();
}

module.exports = { FridayInteractiveChat };
