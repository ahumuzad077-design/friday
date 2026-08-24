#!/usr/bin/env node
const { exec } = require("child_process");

function openWebsite(url) {
    let command = "";
    const platform = process.platform;

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
    }

    if (platform === "win32") {
        command = `start "" "${url}"`;
    } else if (platform === "darwin") {
        command = `open "${url}"`;
    } else {
        command = `xdg-open "${url}"`;
    }

    console.log(`[F.R.I.D.A.Y.]: Opening website directly -> ${url}`);
    exec(command, (err) => {
        if (err) {
            console.error("[Error opening browser]:", err.message);
        }
    });
}

const args = process.argv.slice(2);
const command = args[0] ? args[0].toLowerCase() : "help";
const target = args[1];

if (command === "open") {
    if (!target) {
        console.log("[F.R.I.D.A.Y.]: Please specify a website to open. Example: node friday-cli.js open dropship.io");
    } else {
        openWebsite(target);
    }
} else if (command === "search") {
    const query = args.slice(1).join(" ");
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    openWebsite(searchUrl);
} else if (command === "nasa") {
    console.log("[F.R.I.D.A.Y.]: Fetching live NASA feed and opening visual...");
    fetch("https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY")
        .then(res => res.json())
        .then(data => {
            console.log(`NASA Title: ${data.title}`);
            openWebsite(data.url);
        })
        .catch(() => openWebsite("https://apod.nasa.gov/apod/astropix.html"));
} else {
    console.log(`
========================================
 F.R.I.D.A.Y. Local Command Interface
========================================
 Commands to test right now:
   node friday-cli.js open dropship.io
   node friday-cli.js search "how to hit 10k revenue"
   node friday-cli.js nasa
    `);
}
