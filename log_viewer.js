const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3001;
const memoryFile = path.join(__dirname, "friday_lessons.json");

const server = http.createServer((req, res) => {
    let lessons = [];
    if (fs.existsSync(memoryFile)) {
        try {
            lessons = JSON.parse(fs.readFileSync(memoryFile, "utf8"));
        } catch (e) {
            console.error("Error reading log file:", e.message);
        }
    }

    const logCards = lessons.slice().reverse().map(l => `
        <div class="card">
            <span class="tag">${l.taskType}</span>
            <p><strong>Issue / Mistake:</strong> ${l.mistake}</p>
            <p><strong>Correction Strategy:</strong> ${l.correction}</p>
            <div class="date">${l.date}</div>
        </div>
    `).join("");

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Friday Memory & Log Dashboard</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; margin: 0; }
            h1 { color: #38bdf8; margin-bottom: 8px; }
            .subtitle { color: #94a3b8; margin-bottom: 24px; }
            .card { background: #1e293b; padding: 16px; margin-bottom: 12px; border-radius: 8px; border-left: 4px solid #38bdf8; }
            .tag { background: #0284c7; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; font-weight: bold; }
            .date { font-size: 0.8em; color: #64748b; margin-top: 8px; }
        </style>
    </head>
    <body>
        <h1>Friday Engine Memory Logs</h1>
        <div class="subtitle">Total Learned Lessons Recorded: ${lessons.length}</div>
        ${lessons.length === 0 ? "<p>No lessons recorded yet. Run <code>npm start</code> to generate activity.</p>" : logCards}
    </body>
    </html>`;

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
});

server.listen(PORT, () => {
    console.log(`[Log Dashboard]: Running live at http://localhost:${PORT}`);
});
