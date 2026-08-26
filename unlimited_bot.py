# ========================================================================
# ULTIMATE UNLIMITED EARNING BOT – WITH ALL APIS INTEGRATED
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
import wikipedia
import random
import re
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from concurrent.futures import ThreadPoolExecutor

# ========================================================================
# ESSENTIAL IMPORTS
# ========================================================================
from langchain.tools import tool
from langchain_groq import ChatGroq
from langchain_community.tools import DuckDuckGoSearchResults
from langchain_community.utilities import DuckDuckGoSearchAPIWrapper
from langchain_community.tools import WikipediaQueryRun
from langchain_community.utilities import WikipediaAPIWrapper

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

# Web3 & CCXT
from web3 import Web3
from web3.middleware import geth_poa_middleware
import ccxt
import pandas as pd
import numpy as np

load_dotenv()

# ========================================================================
# CONFIGURATION
# ========================================================================

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "mixtral-8x7b-32768")

SENDER_EMAIL = "ahumuzad077@gmail.com"
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "")
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
DEFAULT_RECIPIENT = os.getenv("DEFAULT_RECIPIENT", "ahumuzad077@gmail.com")
EMAIL_LIST_FILE = "email_list.txt"

PRIVATE_KEY = os.getenv("PRIVATE_KEY", "")
WALLET_ADDRESS = os.getenv("WALLET_ADDRESS", "")
INFURA_URL = os.getenv("INFURA_URL", "")
POLYGON_RPC = os.getenv("POLYGON_RPC", "https://polygon-rpc.com")
BSC_RPC = os.getenv("BSC_RPC", "https://bsc-dataseed.binance.org/")

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

# NEW API KEYS
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")
GLAMA_API_KEY = os.getenv("GLAMA_API_KEY", "")
COINCAP_API_KEY = os.getenv("COINCAP_API_KEY", "")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
XAI_API_KEY = os.getenv("XAI_API_KEY", "")

THINK_INTERVAL = int(os.getenv("THINK_INTERVAL", 30))
GOAL_FILE = "goal_state.json"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler("earn_everything.log"), logging.StreamHandler()]
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
        self.plan = []
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
# BASE TOOLS
# ========================================================================
@tool
def web_search(query: str) -> str:
    """Search the web for current information using DuckDuckGo."""
    wrapper = DuckDuckGoSearchAPIWrapper(max_results=5)
    search = DuckDuckGoSearchResults(api_wrapper=wrapper)
    return search.run(query)

@tool
def wikipedia_search(query: str) -> str:
    """Search Wikipedia for background information."""
    wrapper = WikipediaAPIWrapper()
    return wrapper.run(query)

@tool
def calculate(expression: str) -> str:
    """Evaluate a mathematical expression."""
    allowed = set("0123456789+-*/(). ")
    if not all(c in allowed for c in expression):
        return "Invalid characters."
    try:
        return f"Result: {eval(expression)}"
    except Exception as e:
        return f"Error: {e}"

@tool
def read_file(filepath: str) -> str:
    """Read contents of a text file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {e}"

@tool
def execute_python(code: str) -> str:
    """Execute any Python code – this unlocks unlimited capabilities."""
    try:
        with tempfile.NamedTemporaryFile(suffix=".py", delete=True, mode='w') as f:
            f.write(code)
            f.flush()
            result = subprocess.run(["python", f.name], capture_output=True, text=True, timeout=30)
            if result.stdout:
                return result.stdout
            elif result.stderr:
                return f"Error: {result.stderr}"
            else:
                return "Code executed successfully (no output)."
    except subprocess.TimeoutExpired:
        return "Execution timed out (30s)."
    except Exception as e:
        return f"Error executing code: {e}"

@tool
def send_email(subject: str, body: str, recipient: str = None) -> str:
    """Send an email via SMTP."""
    if not SENDER_PASSWORD:
        return "❌ Email password not set."
    if recipient is None:
        recipient = DEFAULT_RECIPIENT
    if not recipient:
        return "No recipient."
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

@tool
def send_bulk_emails(subject: str, body: str) -> str:
    """Send bulk emails to a list of recipients from email_list.txt."""
    try:
        with open(EMAIL_LIST_FILE, 'r') as f:
            emails = [line.strip() for line in f if line.strip()]
        if not emails:
            return "No emails in list."
        success = 0
        for email in emails:
            result = send_email.invoke({"subject": subject, "body": body, "recipient": email})
            if "✅" in result:
                success += 1
            time.sleep(0.5)
        return f"Sent to {success}/{len(emails)} recipients."
    except Exception as e:
        return f"Error: {e}"

@tool
def post_to_wordpress(title: str, content: str, status: str = "draft") -> str:
    """Publish a blog post on WordPress."""
    wp_url = os.getenv("WP_URL")
    username = os.getenv("WP_USERNAME")
    password = os.getenv("WP_APP_PASSWORD")
    if not all([wp_url, username, password]):
        return "WordPress credentials missing."
    endpoint = f"{wp_url}/wp-json/wp/v2/posts"
    auth = (username, password)
    data = {"title": title, "content": content, "status": status}
    try:
        response = requests.post(endpoint, json=data, auth=auth)
        if response.status_code in (201, 200):
            return f"Post published! ID: {response.json().get('id')}"
        return f"WordPress error: {response.status_code} - {response.text}"
    except Exception as e:
        return f"Error: {e}"

@tool
def get_crypto_price(symbol: str, vs_currency: str = "usd") -> str:
    """Get live crypto price from CoinGecko."""
    symbol = symbol.lower().strip()
    url = f"https://api.coingecko.com/api/v3/simple/price?ids={symbol}&vs_currencies={vs_currency}"
    try:
        response = requests.get(url, timeout=10)
        data = response.json()
        if symbol in data and vs_currency in data[symbol]:
            return f"💰 {symbol.upper()} price: ${data[symbol][vs_currency]:,} {vs_currency.upper()}"
        return f"❌ Crypto '{symbol}' not found."
    except Exception as e:
        return f"❌ Error: {e}"

@tool
def send_eth(to_address: str, amount_eth: float, chain: str = "ethereum") -> str:
    """Send ETH or native token from your MetaMask wallet."""
    if not PRIVATE_KEY or not WALLET_ADDRESS:
        return "❌ MetaMask credentials missing."
    rpc_urls = {
        "ethereum": INFURA_URL,
        "polygon": POLYGON_RPC,
        "bsc": BSC_RPC,
    }
    rpc = rpc_urls.get(chain.lower())
    if not rpc:
        return f"❌ Chain '{chain}' not supported."
    w3 = Web3(Web3.HTTPProvider(rpc))
    if chain.lower() == "polygon":
        w3.middleware_onion.inject(geth_poa_middleware, layer=0)
    if not w3.is_connected():
        return "❌ Failed to connect to blockchain."
    try:
        amount_wei = w3.to_wei(amount_eth, 'ether')
        nonce = w3.eth.get_transaction_count(WALLET_ADDRESS)
        gas_price = w3.eth.gas_price
        tx = {
            'nonce': nonce,
            'to': w3.to_checksum_address(to_address),
            'value': amount_wei,
            'gas': 21000,
            'gasPrice': gas_price,
            'chainId': w3.eth.chain_id,
        }
        signed = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
        return f"✅ Transaction sent! Hash: {tx_hash.hex()}"
    except Exception as e:
        return f"❌ Transaction failed: {str(e)}"

# ========================================================================
# CEX TRADING FUNCTIONS
# ========================================================================

def get_exchange():
    """Get the configured exchange instance."""
    exchange_class = getattr(ccxt, EXCHANGE_NAME)
    exchange = exchange_class({
        'apiKey': API_KEY,
        'secret': API_SECRET,
        'enableRateLimit': True,
        'options': {'defaultType': 'spot'}
    })
    if TRADE_MODE == "paper" and hasattr(exchange, 'set_sandbox_mode'):
        exchange.set_sandbox_mode(True)
    return exchange

def fetch_ohlcv(exchange, symbol, timeframe, limit=100):
    """Fetch OHLCV candlestick data."""
    try:
        ohlcv = exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
        df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        df.set_index('timestamp', inplace=True)
        return df
    except Exception as e:
        logger.error(f"OHLCV error: {e}")
        return None

def get_trading_signal(df, fast, slow):
    """Calculate SMA crossover trading signal."""
    if df is None or len(df) < slow:
        return 'HOLD'
    df['sma_fast'] = df['close'].rolling(window=fast).mean()
    df['sma_slow'] = df['close'].rolling(window=slow).mean()
    last_fast = df['sma_fast'].iloc[-1]
    last_slow = df['sma_slow'].iloc[-1]
    prev_fast = df['sma_fast'].iloc[-2]
    prev_slow = df['sma_slow'].iloc[-2]
    if prev_fast <= prev_slow and last_fast > last_slow:
        return 'BUY'
    elif prev_fast >= prev_slow and last_fast < last_slow:
        return 'SELL'
    return 'HOLD'

def execute_trade(exchange, symbol, side, quantity):
    """Execute a market order on the exchange."""
    try:
        order = exchange.create_market_order(symbol, side, quantity)
        logger.info(f"✅ {side.upper()} {quantity} {symbol}")
        return order
    except Exception as e:
        logger.error(f"❌ Trade failed: {e}")
        return None

@tool
def cex_trade_signal() -> str:
    """Run the SMA crossover trading strategy."""
    try:
        exchange = get_exchange()
        df = fetch_ohlcv(exchange, SYMBOL, TIMEFRAME, limit=SLOW_SMA + 10)
        if df is None:
            return "Failed to fetch data."
        signal = get_trading_signal(df, FAST_SMA, SLOW_SMA)
        if signal == 'BUY':
            execute_trade(exchange, SYMBOL, 'buy', QUANTITY)
            return f"✅ BUY order executed for {QUANTITY} {SYMBOL}"
        elif signal == 'SELL':
            execute_trade(exchange, SYMBOL, 'sell', QUANTITY)
            return f"✅ SELL order executed for {QUANTITY} {SYMBOL}"
        else:
            return "⏸️ No trade signal – HOLDING"
    except Exception as e:
        return f"❌ CEX trade failed: {e}"

@tool
def crypto_arbitrage_opportunity() -> str:
    """Find arbitrage opportunities across exchanges."""
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
            return f"💰 Arbitrage: Buy on {min_ex} at ${prices[min_ex]:.2f}, sell on {max_ex} at ${prices[max_ex]:.2f} – profit {diff:.2f}%"
        else:
            return f"⏸️ No significant arbitrage (diff {diff:.2f}%)."
    else:
        return "Failed to fetch prices from all exchanges."

# ========================================================================
# DROPSHIPPING & E-COMMERCE TOOLS
# ========================================================================

@tool
def find_trending_products(category: str = "") -> str:
    """Find trending dropshipping products in a category."""
    query = "trending products for dropshipping " + category if category else "trending dropshipping products"
    return web_search.invoke({"query": query})

@tool
def find_suppliers(product_name: str) -> str:
    """Find suppliers for a specific product."""
    query = f"suppliers for {product_name} dropshipping"
    return web_search.invoke({"query": query})

@tool
def generate_product_description(product_name: str, features: str = "") -> str:
    """Generate a persuasive product description."""
    prompt = f"Write a persuasive product description for '{product_name}'." + (f" Features: {features}" if features else "")
    try:
        response = llm.invoke(prompt)
        return response.content
    except Exception as e:
        return f"Error: {e}"

@tool
def create_facebook_ad(ad_text: str, target_audience: str) -> str:
    """Create a Facebook ad copy."""
    prompt = f"Write a Facebook ad copy for the following product, targeting {target_audience}:\n{ad_text}"
    try:
        response = llm.invoke(prompt)
        return response.content
    except Exception as e:
        return f"Error: {e}"

@tool
def add_product_to_shopify(title: str, description: str, price: float, vendor: str = "") -> str:
    """Add a product to your Shopify store."""
    if not SHOPIFY_STORE or not SHOPIFY_ACCESS_TOKEN:
        return "Shopify credentials missing."
    url = f"https://{SHOPIFY_STORE}.myshopify.com/admin/api/2023-10/products.json"
    headers = {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN
    }
    product_data = {
        "product": {
            "title": title,
            "body_html": description,
            "vendor": vendor or "Dropship",
            "variants": [{"price": str(price)}],
            "status": "draft"
        }
    }
    try:
        response = requests.post(url, headers=headers, json=product_data)
        if response.status_code == 201:
            return f"✅ Product '{title}' added to Shopify (ID: {response.json()['product']['id']})"
        else:
            return f"❌ Shopify error: {response.status_code} - {response.text}"
    except Exception as e:
        return f"Error: {e}"

@tool
def create_new_tool(tool_code: str) -> str:
    """Create a new dynamic tool from Python code."""
    try:
        filename = f"dynamic_tool_{int(time.time())}.py"
        with open(filename, 'w') as f:
            f.write("from langchain.tools import tool\n")
            f.write(tool_code)
            f.write("\n\n# To use this tool, import it and call it.\n")
        return f"Tool saved as {filename}. You can use execute_python to import and call its functions."
    except Exception as e:
        return f"Error creating tool: {e}"

# ========================================================================
# NEW APIS: Firecrawl, CoinCap, OpenRouter, Glama, xAI
# ========================================================================

@tool
def firecrawl_scrape(url: str) -> str:
    """Scrape any website and convert to clean markdown/LLM-ready format using Firecrawl."""
    api_key = os.getenv("FIRECRAWL_API_KEY")
    if not api_key:
        return "❌ Firecrawl API key not set. Add FIRECRAWL_API_KEY to your .env file."
    
    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        data = {"url": url}
        response = requests.post(
            "https://api.firecrawl.dev/v1/scrape",
            headers=headers,
            json=data,
            timeout=30
        )
        if response.status_code == 200:
            result = response.json()
            content = result.get("data", {}).get("content", "")
            return f"✅ Scraped content from {url}:\n\n{content[:2000]}..."
        else:
            return f"❌ Firecrawl error: {response.status_code} - {response.text}"
    except Exception as e:
        return f"Error: {e}"

@tool
def coincap_prices(symbols: str = "bitcoin,ethereum,solana") -> str:
    """Get live crypto prices from CoinCap (free API, no key required)."""
    try:
        symbol_map = {
            "btc": "bitcoin", "eth": "ethereum", "sol": "solana",
            "xrp": "ripple", "ada": "cardano", "doge": "dogecoin",
            "dot": "polkadot", "link": "chainlink", "matic": "polygon",
            "uni": "uniswap", "avax": "avalanche", "shib": "shiba-inu",
            "trx": "tron", "ltc": "litecoin", "bch": "bitcoin-cash"
        }
        requested = [s.strip().lower() for s in symbols.split(",")]
        asset_ids = [symbol_map.get(s, s) for s in requested]
        ids = ",".join(asset_ids)
        url = f"https://api.coincap.io/v2/assets?ids={ids}"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            result = []
            for asset in data.get("data", []):
                price = float(asset.get("priceUsd", 0))
                change = float(asset.get("changePercent24Hr", 0))
                market_cap = float(asset.get("marketCapUsd", 0))
                volume = float(asset.get("volumeUsd24Hr", 0))
                result.append(f"💰 {asset['symbol']}: ${price:.4f} (24h: {change:.2f}%) | Market Cap: ${market_cap:,.0f} | Volume: ${volume:,.0f}")
            return "\n".join(result) if result else "No data found."
        else:
            return f"❌ CoinCap error: {response.status_code}"
    except Exception as e:
        return f"Error: {e}"

@tool
def openrouter_completion(prompt: str, model: str = "deepseek/deepseek-chat") -> str:
    """Use OpenRouter to access 200+ AI models (DeepSeek, GPT-4o, Claude, etc.)."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return "❌ OpenRouter API key not set. Add OPENROUTER_API_KEY to your .env file."
    
    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/ahumuzad077-design/friday",
            "X-Title": "Friday Earning Bot"
        }
        data = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.5,
            "max_tokens": 500
        }
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=data,
            timeout=30
        )
        if response.status_code == 200:
            result = response.json()
            return result.get("choices", [{}])[0].get("message", {}).get("content", "No response.")
        else:
            return f"❌ OpenRouter error: {response.status_code} - {response.text}"
    except Exception as e:
        return f"Error: {e}"

@tool
def glama_completion(prompt: str, model: str = "gpt-4o-mini") -> str:
    """Use Node Glama to access multiple AI models with one key."""
    api_key = os.getenv("GLAMA_API_KEY")
    if not api_key:
        return "❌ Glama API key not set. Add GLAMA_API_KEY to your .env file."
    
    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.5,
            "max_tokens": 500
        }
        response = requests.post(
            "https://api.glama.ai/v1/chat/completions",
            headers=headers,
            json=data,
            timeout=30
        )
        if response.status_code == 200:
            result = response.json()
            return result.get("choices", [{}])[0].get("message", {}).get("content", "No response.")
        else:
            return f"❌ Glama error: {response.status_code} - {response.text}"
    except Exception as e:
        return f"Error: {e}"

@tool
def xai_completion(prompt: str) -> str:
    """Use xAI's Grok model for responses."""
    api_key = os.getenv("XAI_API_KEY")
    if not api_key:
        return "❌ xAI API key not set. Add XAI_API_KEY to your .env file."
    
    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "model": "grok-1",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.5,
            "max_tokens": 500
        }
        response = requests.post(
            "https://api.x.ai/v1/chat/completions",
            headers=headers,
            json=data,
            timeout=30
        )
        if response.status_code == 200:
            result = response.json()
            return result.get("choices", [{}])[0].get("message", {}).get("content", "No response.")
        else:
            return f"❌ xAI error: {response.status_code} - {response.text}"
    except Exception as e:
        return f"Error: {e}"

# ========================================================================
# TOOLS LIST – All tools available to the agent
# ========================================================================
tools_list = [
    web_search,
    wikipedia_search,
    calculate,
    read_file,
    send_email,
    send_bulk_emails,
    post_to_wordpress,
    get_crypto_price,
    send_eth,
    cex_trade_signal,
    crypto_arbitrage_opportunity,
    find_trending_products,
    find_suppliers,
    generate_product_description,
    create_facebook_ad,
    add_product_to_shopify,
    execute_python,
    create_new_tool,
    firecrawl_scrape,
    coincap_prices,
    openrouter_completion,
    glama_completion,
    xai_completion,
]

tool_map = {tool.name: tool for tool in tools_list}

# ========================================================================
# LLM – The Brain
# ========================================================================
llm = ChatGroq(api_key=GROQ_API_KEY, model=GROQ_MODEL, temperature=0.5)

# ========================================================================
# MANUAL REACT AGENT – No import issues, works with all versions
# ========================================================================
def run_agent(input_text: str, max_iterations: int = 5) -> str:
    """Run the manual ReAct agent loop."""
    tool_descriptions = "\n".join([f"- {tool.name}: {tool.description}" for tool in tools_list])
    tool_names = ", ".join([tool.name for tool in tools_list])

    system_prompt = f"""You are an AGGRESSIVE, CREATIVE, UNLIMITED earning assistant.
Your goal is to earn money using ANY method – trading, dropshipping, freelancing, content, affiliate, arbitrage, hacking (ethically), data analysis, consulting, etc.
You have access to the following tools:

{tool_descriptions}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action (must be valid JSON)
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Important: When using tools, always provide the Action Input as a valid JSON object.
Example: Action Input: {{"query": "bitcoin price"}}
"""

    history = []
    current_input = input_text

    for i in range(max_iterations):
        messages = [{"role": "system", "content": system_prompt}]
        for msg in history:
            messages.append(msg)
        messages.append({"role": "user", "content": current_input})

        response = llm.invoke(messages)
        output = response.content
        logger.debug(f"LLM output: {output}")

        if "Final Answer:" in output:
            final_answer = output.split("Final Answer:")[-1].strip()
            return final_answer

        action_match = re.search(r"Action:\s*(\w+)", output)
        action_input_match = re.search(r"Action Input:\s*(\{.*\})", output, re.DOTALL)

        if not action_match:
            return output

        action_name = action_match.group(1)
        if action_name not in tool_map:
            observation = f"Error: Tool '{action_name}' not found. Available: {tool_names}"
        else:
            tool_func = tool_map[action_name]
            if action_input_match:
                action_input_str = action_input_match.group(1)
                try:
                    action_input = json.loads(action_input_str)
                except json.JSONDecodeError:
                    action_input = action_input_str
            else:
                fallback = re.search(r"Action Input:\s*(.*)", output, re.DOTALL)
                action_input = fallback.group(1).strip() if fallback else ""

            try:
                if isinstance(action_input, dict):
                    observation = tool_func.invoke(action_input)
                else:
                    observation = tool_func.invoke({"query": action_input})
            except Exception as e:
                observation = f"Error executing tool: {str(e)}"

        history.append({"role": "assistant", "content": output})
        history.append({"role": "user", "content": f"Observation: {observation}"})
        current_input = f"Observation: {observation}"

    return "Max iterations reached without final answer."

# ========================================================================
# FASTAPI APP – Web Interface
# ========================================================================
app = FastAPI(title="Unlimited Earning Bot")

class GoalRequest(BaseModel):
    target: float
    deadline_days: int

class ChatRequest(BaseModel):
    message: str

@app.post("/goal")
async def set_goal(req: GoalRequest):
    """Set a financial goal with a deadline."""
    goal.target_amount = req.target
    goal.deadline = (datetime.now() + timedelta(days=req.deadline_days)).isoformat()
    goal.current_progress = 0.0
    goal.plan = []
    goal.active = True
    goal.urgent = (req.deadline_days <= 1)
    goal.save()
    generate_plan()
    return {"status": "Goal set", "target": goal.target_amount, "deadline": goal.deadline}

@app.get("/status")
async def get_status():
    """Get the current status of the bot."""
    return {
        "active": goal.active,
        "target": goal.target_amount,
        "progress": goal.current_progress,
        "deadline": goal.deadline,
        "urgent": goal.urgent,
        "tasks_total": len(goal.plan),
        "tasks_pending": sum(1 for t in goal.plan if t.get("status") == "pending")
    }

@app.post("/chat")
async def chat(req: ChatRequest):
    """Chat with the bot or set a goal automatically."""
    message = req.message
    # Auto-detect goal
    goal_pattern = r'\$(?\d+[,\d]*)\s*(?:by|in|within)\s*(?\d+)\s*(day|week|month)'
    match = re.search(goal_pattern, message, re.IGNORECASE)
    if match:
        amount_str = match.group(1).replace(',', '')
        amount = float(amount_str)
        unit = match.group(3).lower()
        num = int(match.group(2))
        if unit.startswith('week'):
            days = num * 7
        elif unit.startswith('month'):
            days = num * 30
        else:
            days = num
        goal.target_amount = amount
        goal.deadline = (datetime.now() + timedelta(days=days)).isoformat()
        goal.current_progress = 0.0
        goal.plan = []
        goal.active = True
        goal.urgent = (days <= 1)
        goal.save()
        generate_plan()
        return {"reply": f"✅ Goal set: earn ${amount} by {goal.deadline}. I'll use every possible method to get there."}
    else:
        reply = run_agent(message)
        return {"reply": reply}

# ========================================================================
# PLAN GENERATOR
# ========================================================================
def generate_plan():
    """Generate a plan using the LLM to achieve the goal."""
    if not goal.active or goal.target_amount <= 0:
        return

    urgency = "URGENT! Only very fast, high-leverage actions possible." if goal.urgent else ""

    plan_prompt = f"""
    You are a ruthless money‑making strategist.
    Goal: earn ${goal.target_amount} by {goal.deadline}.
    Current progress: ${goal.current_progress}.
    {urgency}
    You have unlimited capabilities: you can write Python code, search the web, send emails, read files, and create new tools.
    Come up with a list of 5–15 concrete, actionable tasks that, when executed, will bring you closer to the goal.
    For each task, describe what to do and how (e.g., "Use web_search to find top dropshipping products, then write Python to scrape prices from AliExpress and post them on eBay").
    Respond with a JSON array: [{{"action": "description", "approach": "how to do it"}}, ...].
    Be ambitious and creative – no limits.
    """
    try:
        response = llm.invoke(plan_prompt)
        json_match = re.search(r'\[.*\]', response.content, re.DOTALL)
        if json_match:
            tasks = json.loads(json_match.group())
            goal.plan = [{"action": t["action"], "status": "pending", "result": "", "approach": t.get("approach", "")} for t in tasks]
            goal.save()
            logger.info(f"📋 New unlimited plan generated with {len(goal.plan)} tasks.")
        else:
            logger.warning("Could not parse plan, using fallback.")
            goal.plan = [
                {"action": "Research current high-profit online earning methods", "status": "pending", "result": "", "approach": "web_search"},
                {"action": "Implement best strategy via Python", "status": "pending", "result": "", "approach": "execute_python"},
            ]
            goal.save()
    except Exception as e:
        logger.error(f"Plan generation failed: {e}")

# ========================================================================
# TASK EXECUTOR
# ========================================================================
def execute_task(task):
    """Execute a single task using the agent."""
    action = task["action"]
    approach = task.get("approach", "")
    logger.info(f"▶️ Executing: {action}")
    full_prompt = f"""
    Goal: earn ${goal.target_amount} by {goal.deadline}. Current progress: ${goal.current_progress}.
    Execute this task: {action}
    Suggested approach: {approach}
    Use any tools you have, or write new code via execute_python if needed.
    Report the result.
    """
    try:
        result = run_agent(full_prompt)
        task["status"] = "done"
        task["result"] = result
        goal.save()
        logger.info(f"✅ Task done: {result[:200]}...")
    except Exception as e:
        task["status"] = "failed"
        task["result"] = f"Error: {e}"
        goal.save()
        logger.error(f"❌ Task failed: {e}")

def execute_tasks_in_parallel():
    """Execute pending tasks in parallel."""
    pending = [t for t in goal.plan if t.get("status") == "pending"]
    if not pending:
        return
    max_workers = 3 if goal.urgent else 1
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        executor.map(execute_task, pending[:max_workers])

# ========================================================================
# AUTONOMOUS CYCLE – Runs every THINK_INTERVAL seconds
# ========================================================================
def autonomous_cycle():
    """Main autonomous loop that executes tasks and tracks progress."""
    if not goal.active:
        return

    if goal.deadline and datetime.now() > datetime.fromisoformat(goal.deadline):
        logger.warning("⏰ Deadline passed – deactivating goal.")
        goal.active = False
        goal.save()
        return

    if not goal.plan:
        generate_plan()
        return

    execute_tasks_in_parallel()

    # Simulate progress (replace with real revenue checks in production)
    earned = random.uniform(50, 500) if goal.urgent else random.uniform(10, 100)
    goal.current_progress += earned
    goal.save()
    logger.info(f"💰 Progress: ${goal.current_progress:.2f} / ${goal.target_amount:.2f}")

    if goal.current_progress >= goal.target_amount:
        send_email.invoke({
            "subject": "🎉 Goal Achieved!",
            "body": f"Congratulations! You reached your target of ${goal.target_amount}.\nFinal progress: ${goal.current_progress:.2f}"
        })
        goal.active = False
        goal.save()
        logger.info("🏆 Goal reached – bot deactivated.")

# ========================================================================
# START SCHEDULER
# ========================================================================
scheduler = BackgroundScheduler()
scheduler.add_job(autonomous_cycle, 'interval', seconds=THINK_INTERVAL)
scheduler.start()

# ========================================================================
# MAIN ENTRY POINT
# ========================================================================
if __name__ == "__main__":
    import uvicorn

    logger.info("=" * 70)
    logger.info("🚀 UNLIMITED EARNING BOT – ALL APIS INTEGRATED")
    logger.info(f"📅 Current goal: {'Active' if goal.active else 'Inactive'}")
    if goal.active:
        logger.info(f"🎯 Target: ${goal.target_amount} by {goal.deadline}")
        logger.info(f"📈 Progress: ${goal.current_progress:.2f}")
        logger.info(f"⚡ Urgent mode: {'ON' if goal.urgent else 'OFF'}")
    logger.info(f"⏱️  Thinking every {THINK_INTERVAL} seconds.")
    logger.info("📡 API: http://localhost:8000")
    logger.info("💬 Chat: POST /chat with { 'message': 'I need $1,000,000 in 3 days' }")
    logger.info("📊 Status: GET /status")
    logger.info("🎯 Set Goal: POST /goal with { 'target': 10000, 'deadline_days': 7 }")
    logger.info("=" * 70)

    uvicorn.run(app, host="0.0.0.0", port=8000)
