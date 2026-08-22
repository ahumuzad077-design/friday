require("dotenv").config();
const { ethers } = require("ethers");

async function checkWallet() {
    console.log("\n==========================================");
    console.log("🦊 FRIDAY WEB3 DIAGNOSTIC (COINBASE RPC)");
    console.log("==========================================\n");

    // 1. Connect to the Blockchain via your Coinbase RPC URL
    // Make sure COINBASE_RPC_URL is in your .env file
    const rpcUrl = process.env.COINBASE_RPC_URL || "https://mainnet.base.org"; // Using Base network as default fallback
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // 2. Your Public MetaMask Address
    const walletAddress = process.env.METAMASK_PUBLIC_ADDRESS || "0x30d8FA6ee6240B1537b1A7704643EDa9AD1704Fc";

    if (walletAddress.includes("PASTE")) {
        console.log("❌ Error: Please paste your public MetaMask address in the script or .env file.");
        return;
    }

    try {
        console.log(`📡 Pinging network via Coinbase API...`);
        const network = await provider.getNetwork();
        console.log(`✅ Connected to Network: ${network.name} (Chain ID: ${network.chainId})`);

        console.log(`\n💼 Scanning blockchain for wallet: ${walletAddress}...`);
        
        // Fetch raw balance in Wei (the smallest unit of crypto)
        const balanceWei = await provider.getBalance(walletAddress);
        
        // Convert Wei to standard ETH format
        const balanceEth = ethers.formatEther(balanceWei);
        
        console.log(`💰 Live Wallet Balance: ${balanceEth} ETH`);
        console.log("\n==========================================\n");
    } catch (error) {
        console.error("❌ Connection Failed:", error.message);
    }
}

checkWallet();
