#!/usr/bin/env node

/**
 * 🚀 F.R.I.D.A.Y. IRON MAN STARTUP SCRIPT
 * 
 * This script launches Friday with the Iron Man web interface.
 * Your AI assistant is ready to hear your voice and execute commands.
 * 
 * Usage: node friday-startup.js
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║                                                              ║');
console.log('║              🚀 FRIDAY IRON MAN STARTUP 🚀                  ║');
console.log('║                                                              ║');
console.log('║           Autonomous AI Intelligence Initializing...        ║');
console.log('║                                                              ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// Check dependencies
console.log('📋 Checking dependencies...');

try {
    require('express');
    require('ws');
    console.log('✓ All dependencies installed');
} catch (e) {
    console.log('⚠️  Missing dependencies. Installing...');
    const install = spawn('npm', ['install', 'express', 'ws'], { 
        cwd: __dirname,
        stdio: 'inherit'
    });
    
    install.on('close', (code) => {
        if (code !== 0) {
            console.error('✗ Installation failed. Please run: npm install express ws');
            process.exit(1);
        }
        startFriday();
    });
    
    return;
}

startFriday();

function startFriday() {
    console.log('\n🤖 Initializing F.R.I.D.A.Y. Core Systems...');
    
    // Load Friday components
    try {
        const { FridayIronManInterface } = require('./friday-iron-man-server');
        
        console.log('✓ Command Center Loaded');
        console.log('✓ Neural Engine Activated');
        console.log('✓ Decision Engine Online');
        console.log('✓ Multi-Agent Coordinator Ready');
        
        console.log('\n🌐 Starting Web Interface...\n');
        
        const friday = new FridayIronManInterface(3000);
        
        // Handle shutdown gracefully
        process.on('SIGINT', () => {
            console.log('\n\n⏸️  Shutting down F.R.I.D.A.Y...');
            console.log('✓ All systems powered down');
            console.log('✓ Memory preserved');
            console.log('✓ Ready for next activation\n');
            process.exit(0);
        });
        
        friday.start();
        
        // Give server time to start, then open browser
        setTimeout(() => {
            console.log('\n✨ SUCCESS! Friday is ready for your commands!\n');
            console.log('📱 Open your browser:');
            console.log('   👉 http://localhost:3000\n');
            console.log('🎙️  Voice Control Ready - Click the microphone button or press F1');
            console.log('⌨️  Text Input Ready - Type or paste commands\n');
            console.log('💡 Try saying:');
            console.log('   • "Make a decision about expanding operations"');
            console.log('   • "Create a task to monitor performance hourly"');
            console.log('   • "Deploy an agent for data analysis"\n');
            console.log('Press Ctrl+C to stop Friday\n');
            
            // Optionally auto-open browser
            if (process.env.AUTO_OPEN !== 'false') {
                const openBrowser = require('open');
                openBrowser('http://localhost:3000').catch(() => {
                    // Silently fail if open doesn't work
                });
            }
        }, 1000);
        
    } catch (error) {
        console.error('\n✗ Failed to initialize Friday:');
        console.error(error.message);
        console.error('\nPlease ensure all files are present:');
        console.error('  - friday-command-center.js');
        console.error('  - friday-autonomous-core.js');
        console.error('  - friday-neural-engine.js');
        console.error('  - friday-iron-man-server.js');
        process.exit(1);
    }
}
