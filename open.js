const { exec } = require("child_process");

const args = process.argv.slice(2);
let target = args[0];

if (!target) {
    console.log("Usage: node open.js <url>");
    process.exit(1);
}

if (!target.startsWith("http://") && !target.startsWith("https://")) {
    target = "https://" + target;
}

const platform = process.platform;
let command = "";

if (platform === "win32") {
    command = `start "" "${target}"`;
} else if (platform === "darwin") {
    command = `open "${target}"`;
} else {
    command = `xdg-open "${target}"`;
}

console.log(`[F.R.I.D.A.Y.]: Opening -> ${target}`);
exec(command, (err) => {
    if (err) console.error("Error opening browser:", err.message);
});
