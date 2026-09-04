// ===========================================================================
// F.R.I.D.A.Y. BUSINESS INTEGRATION FRAMEWORK
// Shows how to integrate Friday into real company operations
// ===========================================================================

const { 
    PersistentMemory, 
    SkillAcquisition, 
    AutonomousDecisionEngine, 
    BusinessOperationsEngine 
} = require('./friday-autonomous-core');

// ==================== BUSINESS WORKFLOW EXAMPLE ====================
class FridayBusinessIntegration {
    constructor() {
        this.memory = new PersistentMemory();
        this.skills = new SkillAcquisition(this.memory);
        this.decisionEngine = new AutonomousDecisionEngine(this.memory, this.skills);
        this.businessOps = new BusinessOperationsEngine(this.memory);
    }
    
    // ==================== EXAMPLE 1: E-COMMERCE OPERATIONS ====================
    setupEcommerceOperations() {
        console.log('[Setting up E-Commerce Operations]\n');
        
        // Schedule inventory checks
        this.businessOps.scheduleTask('inventory-check', 'hourly', () => {
            console.log('✓ Checking inventory levels...');
        });
        
        // Schedule order processing
        this.businessOps.scheduleTask('process-orders', 'every-15-minutes', () => {
            console.log('✓ Processing pending orders...');
        });
        
        // Add standard e-commerce tasks
        this.businessOps.addToPipeline({
            name: 'Update product listings',
            priority: 'high'
        });
        
        this.businessOps.addToPipeline({
            name: 'Process customer refunds',
            priority: 'critical'
        });
        
        this.businessOps.addToPipeline({
            name: 'Generate sales reports',
            priority: 'normal'
        });
        
        this.memory.recordLearning('E-commerce operations pipeline established');
    }
    
    // ==================== EXAMPLE 2: CUSTOMER SERVICE ====================
    setupCustomerService() {
        console.log('\n[Setting up Customer Service]\n');
        
        // Schedule support ticket processing
        this.businessOps.scheduleTask('process-support-tickets', 'every-30-minutes', () => {
            console.log('✓ Processing support tickets...');
        });
        
        // Add customer service tasks
        this.businessOps.addToPipeline({
            name: 'Respond to customer inquiries',
            priority: 'high'
        });
        
        this.businessOps.addToPipeline({
            name: 'Process complaints',
            priority: 'critical'
        });
        
        this.memory.recordLearning('Customer service operations established');
    }
    
    // ==================== EXAMPLE 3: AUTONOMOUS DECISION MAKING ====================
    demonstrateDecisionMaking() {
        console.log('\n[Autonomous Decision Making Scenarios]\n');
        
        const scenarios = [
            'A product is going out of stock with high demand',
            'Customer satisfaction score dropped 5%',
            'Server response time increased',
            'New competitor launched similar product',
            'Budget for Q4 needs optimization'
        ];
        
        scenarios.forEach(scenario => {
            console.log(`Scenario: ${scenario}`);
            const decision = this.decisionEngine.makeAutonomousDecision(scenario);
            console.log(`Decision: ${decision}\n`);
        });
    }
    
    // ==================== EXAMPLE 4: IMPROVISATION ====================
    demonstrateImprovisation() {
        console.log('\n[Improvisation Examples]\n');
        
        const problems = [
            'Need to reduce shipping costs by 20% without affecting delivery time',
            'Customer retention declining, need retention strategy',
            'Team is overloaded, need process optimization'
        ];
        
        problems.forEach(problem => {
            console.log(`Problem: ${problem}`);
            const solution = this.decisionEngine.improviseSolution(problem);
            console.log(`Improvised Approach: ${solution.approach}\n`);
        });
    }
    
    // ==================== EXAMPLE 5: LEARNING FROM OUTCOMES ====================
    demonstrateLearning() {
        console.log('\n[Learning from Outcomes]\n');
        
        const outcomes = [
            { task: 'task-execution', success: true, context: 'Executed 10 tasks on time' },
            { task: 'decision-making', success: true, context: 'Made decision that increased revenue' },
            { task: 'problem-solving', success: false, context: 'Attempted solution failed, trying new approach' },
            { task: 'automation', success: true, context: 'Automated workflow saved 2 hours' }
        ];
        
        outcomes.forEach(outcome => {
            this.skills.learnFromExperience(outcome.task, outcome.success, outcome.context);
            const skill = this.skills.getSkillProficiency(outcome.task);
            console.log(`${outcome.task}: Level ${skill.level.toFixed(2)} | Confidence ${(skill.confidence * 100).toFixed(0)}%`);
        });
    }
    
    // ==================== EXAMPLE 6: PIPELINE EXECUTION ====================
    executeDemoOperations() {
        console.log('\n[Executing Operations Pipeline]\n');
        
        const results = this.businessOps.executePipeline();
        
        console.log(`Completed ${results.length} tasks:`);
        results.forEach((result, index) => {
            console.log(`${index + 1}. ✓ ${result.name}`);
        });
    }
    
    // ==================== EXAMPLE 7: OPTIMIZATION ====================
    demonstrateOptimization() {
        console.log('\n[Resource Optimization]\n');
        
        console.log('Optimizing operations 5 times...');
        for (let i = 0; i < 5; i++) {
            const metrics = this.businessOps.optimizeResources();
            console.log(`Round ${i + 1}: Efficiency ${(metrics.efficiency * 100).toFixed(1)}%`);
        }
    }
    
    // ==================== EXAMPLE 8: METRICS & REPORTING ====================
    generateReport() {
        console.log('\n[Operational Report]\n');
        
        const m = this.memory.memory;
        
        console.log('=== PERFORMANCE METRICS ===');
        console.log(`Tasks Completed: ${m.operationalMetrics.tasksCompleted}`);
        console.log(`Autonomous Decisions: ${m.operationalMetrics.decisionsAuto}`);
        console.log(`Improvized Solutions: ${m.operationalMetrics.improvizedSolutions}`);
        console.log(`Learning Events: ${m.learningEvents.length}`);
        
        console.log('\n=== SKILL PROFICIENCY ===');
        const skills = this.skills.listSkills();
        for (const [name, prof] of Object.entries(skills)) {
            console.log(`${name}: Level ${prof.level.toFixed(2)}, Confidence ${(prof.confidence * 100).toFixed(0)}%`);
        }
        
        console.log('\n=== RECENT LEARNING ===');
        m.learningEvents.slice(-3).forEach(event => {
            console.log(`- ${event.event}`);
        });
        
        console.log('\n=== RECENT DECISIONS ===');
        m.decisions.slice(-3).forEach(dec => {
            console.log(`- ${dec.decision}`);
        });
    }
    
    // ==================== FULL INTEGRATION DEMO ====================
    runFullDemo() {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('  F.R.I.D.A.Y. BUSINESS INTEGRATION DEMONSTRATION');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        this.setupEcommerceOperations();
        this.setupCustomerService();
        this.demonstrateDecisionMaking();
        this.demonstrateImprovisation();
        this.demonstrateLearning();
        this.executeDemoOperations();
        this.demonstrateOptimization();
        this.generateReport();
        
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  Demo Complete - Friday is ready for operations');
        console.log('═══════════════════════════════════════════════════════════\n');
    }
}

// ==================== ADVANCED INTEGRATION PATTERNS ====================
class AdvancedPatterns {
    // Pattern 1: Feedback Loop
    static createFeedbackLoop(friday, taskName, handler) {
        return async () => {
            const result = await handler();
            if (result.success) {
                friday.skills.learnFromExperience(taskName, true, result.context);
            } else {
                friday.skills.learnFromExperience(taskName, false, result.error);
            }
        };
    }
    
    // Pattern 2: Cascade Decision Making
    static makeCascadeDecision(friday, problem, subProblems) {
        const decisions = {};
        for (const subProblem of subProblems) {
            decisions[subProblem] = friday.decisionEngine.makeAutonomousDecision(subProblem);
        }
        return decisions;
    }
    
    // Pattern 3: Self-Healing Operations
    static createSelfHealingOperation(friday, operation) {
        return {
            execute: async () => {
                try {
                    return await operation();
                } catch (error) {
                    const solution = friday.decisionEngine.improviseSolution(
                        `Operation failed: ${error.message}`
                    );
                    console.log(`Auto-healing with: ${solution.approach}`);
                    return { healed: true, approach: solution.approach };
                }
            }
        };
    }
    
    // Pattern 4: Continuous Improvement Loop
    static setupContinuousImprovement(friday, metrics) {
        return setInterval(() => {
            friday.businessOps.optimizeResources();
            
            // Check metrics and adapt
            if (metrics.errorRate > 0.05) {
                friday.skills.learnFromExperience('error-handling', false, 'Error rate too high');
            } else {
                friday.skills.learnFromExperience('operations', true, 'Stable performance');
            }
        }, 60000); // Every minute
    }
}

// ==================== EXPORTED UTILITIES ====================
module.exports = {
    FridayBusinessIntegration,
    AdvancedPatterns
};

// ==================== RUN DEMO IF EXECUTED DIRECTLY ====================
if (require.main === module) {
    const integration = new FridayBusinessIntegration();
    integration.runFullDemo();
}
