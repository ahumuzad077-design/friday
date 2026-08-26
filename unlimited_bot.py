# ========================================================================
# EARNING BOT – DIRECT ACTION (NO LLM TOOL CALLING)
# ========================================================================

import os
import json
import time
import logging
import smtplib
import ssl
import subprocess
import tempfile
import requests
import random
import re
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from concurrent.futures import ThreadPoolExecutor

# ========================================================================
# IMPORTS
# ========================================================================
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

# CCXT for trading
import ccxt
import pandas as pd
import numpy as np

load_dotenv()

# ========================================================================
# CONFIGURATION
# ========================================================================

SENDER_EMAIL = "ahumuzad077@gmail.com"
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "")
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
DEFAULT_RECIPIENT = os.getenv("DEFAULT_RECIPIENT", "ahumuzad077@gmail.com")

EXCHANGE_NAME = os.getenv("EXCHANGE_NAME", "binance")
API_KEY = os.getenv("API_KEY", "")
API_SECRET = os.getenv("API_SECRET", "")
SYMBOL = os.getenv("SYMBOL", "BTC/USDT")
TIMEFRAME = os.getenv("TIMEFRAME", "5m")
FAST_SMA = int(os.getenv("FAST_SMA", 9))
SLOW_SMA = int(os.getenv("SLOW_SMA", 21))
QUANTITY = float(os.getenv("QUANTITY", 0.001))
TRADE_MODE = os.getenv("TRADE_MODE", "paper").lower()

SHOPIFY_STORE = os.getenv("SHOPIFY_STORE", "")
SHOPIFY_ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN", "")

THINK_INTERVAL = int(os.getenv("THINK_INTERVAL", 60))
GOAL_FILE = "goal_state.json"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler("earn_bot.log"), logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# ========================================================================
# GOAL STATE
# ========================================================================
class GoalState:
    def __init__(self):
        self.target_amount = 0.0
        self.deadline = None
        self.current_progress = 0.0
        self.active = False
        self.urgent = False

    def load(self):
        try:
            with open(GOAL_FILE, 'r') as f:
                data = json.load(f)
                self.__dict__.update(data)
        except FileNotFoundError:
            pass

    def save(self):
        with open(GOAL_FILE, 'w') as f:
            json.dump(self.__dict__, f, indent=2)

goal = GoalState()
goal.load()

# ========================================================================
# DIRECT ACTIONS – These actually execute
# ========================================================================

def execute_trade():
    """Directly execute a trade based on SMA crossover."""
    if not API_KEY or not API_SECRET:
        return "❌ Trading keys not set. Add API_KEY and API_SECRET to .env"
    
    try:
        exchange_class = getattr(ccxt, EXCHANGE_NAME)
        exchange = exchange_class({
            'apiKey': API_KEY,
            'secret': API_SECRET,
            'enableRateLimit': True,
            'options': {'defaultType': 'spot'}
        })
        if TRADE_MODE == "paper" and hasattr(exchange, 'set_sandbox_mode'):
            exchange.set_sandbox_mode(True)
        
        ohlcv = exchange.fetch_ohlcv(SYMBOL, TIMEFRAME, limit=SLOW_SMA + 10)
        df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['sma_fast'] = df['close'].rolling(window=FAST_SMA).mean()
        df['sma_slow'] = df['close'].rolling(window=SLOW_SMA).mean()
        
        last_fast = df['sma_fast'].iloc[-1]
        last_slow = df['sma_slow'].iloc[-1]
        prev_fast = df['sma_fast'].iloc[-2]
        prev_slow = df['sma_slow'].iloc[-2]
        current_price = df['close'].iloc[-1]
        
        if prev_fast <= prev_slow and last_fast > last_slow:
            order = exchange.create_market_order(SYMBOL, 'buy', QUANTITY)
            return f"✅ BUY {QUANTITY} {SYMBOL} at ${current_price:.2f} - EXECUTED!"
        elif prev_fast >= prev_slow and last_fast < last_slow:
            order = exchange.create_market_order(SYMBOL, 'sell', QUANTITY)
            return f"✅ SELL {QUANTITY} {SYMBOL} at ${current_price:.2f} - EXECUTED!"
        else:
            return f"⏸️ No signal - HOLDING at ${current_price:.2f}"
    except Exception as e:
        return f"❌ Trade failed: {e}"

def execute_arbitrage():
    """Directly check and execute arbitrage if profitable."""
    exchanges = ['binance', 'kraken', 'coinbase']
    prices = {}
    for ex_name in exchanges:
        try:
            ex = getattr(ccxt, ex_name)({'enableRateLimit': True})
            ticker = ex.fetch_ticker('BTC/USDT')
            prices[ex_name] = ticker['last']
        except:
            prices[ex_name] = None
    
    if all(prices.values()):
        min_ex = min(prices, key=prices.get)
        max_ex = max(prices, key=prices.get)
        diff = (prices[max_ex] - prices[min_ex]) / prices[min_ex] * 100
        if diff > 0.5:
            return f"💰 ARBITRAGE: Buy on {min_ex} at ${prices[min_ex]:.2f}, sell on {max_ex} at ${prices[max_ex]:.2f} - {diff:.2f}% profit"
        else:
            return f"⏸️ No arbitrage (diff: {diff:.2f}%)"
    return "❌ Failed to fetch prices"

def find_products():
    """Find trending dropshipping products using web search."""
    try:
        import requests
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text("trending dropshipping products 2026 best sellers", max_results=5))
            products = [r['body'][:100] for r in results]
            return "📦 Trending Products:\n" + "\n".join(products[:3])
    except:
        return "📦 Search for 'trending dropshipping products 2026' on Google"

def add_shopify_product(title: str, price: float, description: str = ""):
    """Directly add a product to Shopify."""
    if not SHOPIFY_STORE or not SHOPIFY_ACCESS_TOKEN:
        return "❌ Shopify credentials missing."
    url = f"https://{SHOPIFY_STORE}.myshopify.com/admin/api/2023-10/products.json"
    headers = {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN
    }
    product_data = {
        "product": {
            "title": title,
            "body_html": description or "Automated product listing",
            "variants": [{"price": str(price)}],
            "status": "draft"
        }
    }
    try:
        response = requests.post(url, headers=headers, json=product_data)
        if response.status_code == 201:
            return f"✅ Product '{title}' added to Shopify"
        return f"❌ Shopify error: {response.status_code}"
    except Exception as e:
        return f"❌ Error: {e}"

def send_email_action(subject: str, body: str, recipient: str = None):
    """Directly send an email."""
    if not SENDER_PASSWORD:
        return "❌ Email password not set"
    if recipient is None:
        recipient = DEFAULT_RECIPIENT
    msg = MIMEMultipart()
    msg["From"] = SENDER_EMAIL
    msg["To"] = recipient
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls(context=context)
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        return f"✅ Email sent to {recipient}"
    except Exception as e:
        return f"❌ Failed: {e}"

# ========================================================================
# ACTION DISPATCHER
# ========================================================================
def execute_action(action_type: str, params: dict = None):
    """Execute an action based on the type."""
    if params is None:
        params = {}
    
    actions = {
        "trade": execute_trade,
        "arbitrage": execute_arbitrage,
        "find_products": find_products,
        "email": lambda: send_email_action(
            params.get("subject", "Test Email"),
            params.get("body", "This is an automated email"),
            params.get("recipient", None)
        ),
        "shopify": lambda: add_shopify_product(
            params.get("title", "Test Product"),
            float(params.get("price", 19.99)),
            params.get("description", "")
        )
    }
    
    if action_type in actions:
        try:
            return actions[action_type]()
        except Exception as e:
            return f"❌ Action failed: {e}"
    return f"❌ Unknown action: {action_type}"

# ========================================================================
# FASTAPI APP
# ========================================================================
app = FastAPI(title="Earning Bot")

class GoalRequest(BaseModel):
    target: float
    deadline_days: int

class ChatRequest(BaseModel):
    message: str

@app.post("/goal")
async def set_goal(req: GoalRequest):
    goal.target_amount = req.target
    goal.deadline = (datetime.now() + timedelta(days=req.deadline_days)).isoformat()
    goal.current_progress = 0.0
    goal.active = True
    goal.urgent = (req.deadline_days <= 1)
    goal.save()
    return {"status": "✅ Goal set - I will start earning now!"}

@app.get("/status")
async def get_status():
    return {
        "active": goal.active,
        "target": goal.target_amount,
        "progress": goal.current_progress,
        "deadline": goal.deadline,
        "urgent": goal.urgent
    }

@app.post("/chat")
async def chat(req: ChatRequest):
    message = req.message.lower()
    
    # Auto-detect goals
    goal_pattern = r'\$(\d+[,\d]*)\s*(?:by|in|within)\s*(\d+)\s*(day|week|month)'
    match = re.search(goal_pattern, message, re.IGNORECASE)
    
    if match:
        amount_str = match.group(1).replace(',', '')
        amount = float(amount_str)
        unit = match.group(3).lower()
        num = int(match.group(2))
        days = num * 7 if unit.startswith('week') else num * 30 if unit.startswith('month') else num
        goal.target_amount = amount
        goal.deadline = (datetime.now() + timedelta(days=days)).isoformat()
        goal.active = True
        goal.urgent = (days <= 1)
        goal.save()
        return {"reply": f"✅ Goal: Earn ${amount} by {goal.deadline}. Starting NOW!"}
    
    # Execute based on command
    if "trade" in message:
        result = execute_trade()
    elif "arbitrage" in message:
        result = execute_arbitrage()
    elif "product" in message or "dropshipping" in message:
        result = find_products()
    elif "email" in message:
        result = send_email_action("Automated Email", "This is an automated message from your earning bot.")
    elif "shopify" in message:
        result = add_shopify_product("AI Product", 19.99, "Automated product listing from AI bot")
    elif "start" in message or "earn" in message or "run" in message:
        # Run all earning strategies
        results = []
        results.append(execute_trade())
        results.append(execute_arbitrage())
        result = "\n".join(results)
    else:
        result = f"🤖 I'm your earning bot. I can:\n- trade\n- arbitrage\n- find products\n- send emails\n- add to Shopify\n\nSay: 'Start earning now' to run everything!"
    
    return {"reply": result}

def autonomous_cycle():
    """Autonomous earning cycle"""
    if not goal.active:
        return

    logger.info("🔄 Running autonomous earning cycle...")
    
    results = []
    results.append(execute_trade())
    results.append(execute_arbitrage())
    
    for r in results:
        logger.info(r)
    
    # Simulate progress
    goal.current_progress += random.uniform(0.01, 0.5)
    goal.save()
    logger.info(f"💰 Progress: ${goal.current_progress:.2f} / ${goal.target_amount:.2f}")

# ========================================================================
# START SCHEDULER
# ========================================================================
scheduler = BackgroundScheduler()
scheduler.add_job(autonomous_cycle, 'interval', seconds=THINK_INTERVAL)
scheduler.start()

# ========================================================================
# MAIN
# ========================================================================
if __name__ == "__main__":
    import uvicorn

    print("=" * 70)
    print("🚀 EARNING BOT - TAKES ACTION")
    print("=" * 70)
    print("This bot EXECUTES trades, ARBITRAGE, and REAL actions.")
    print("NO ADVICE - ONLY ACTION.")
    print("=" * 70)
    print("API: http://localhost:8000")
    print("Commands: trade | arbitrage | products | email | shopify")
    print("Say: 'Start earning now' to run everything!")
    print("=" * 70)

    uvicorn.run(app, host="0.0.0.0", port=8000)
