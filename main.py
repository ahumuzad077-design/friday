# =========================================================================
# F.R.I.D.A.Y. - MAIN FASTAPI & LLM INTERFACE (`main.py`)
# =========================================================================

import os
import json
import logging
import smtplib
import ssl
import subprocess
import tempfile
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Web3 & Crypto
from web3 import Web3

# LangChain & FastAPI
from langchain.tools import tool
from langchain_groq import ChatGroq
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.memory import ConversationBufferMemory
from langchain_community.tools import DuckDuckGoSearchResults
from langchain_community.utilities import DuckDuckGoSearchAPIWrapper
from langchain_community.tools import WikipediaQueryRun
from langchain_community.utilities import WikipediaAPIWrapper

from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv

# Import the autonomous engine loop and goal state from bot.py
from bot import goal, generate_plan

# Load environment variables strictly from .env file
load_dotenv()

# =========================================================================
# CONFIGURATION (Strictly from Environment Variables)
# =========================================================================
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
DEFAULT_RECIPIENT = os.getenv("DEFAULT_RECIPIENT")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler("friday.log"), logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# =========================================================================
# TOOLS DEFINITION
# =========================================================================

@tool
def web_search(query: str) -> str:
    """Search the web for current information."""
    wrapper = DuckDuckGoSearchAPIWrapper(max_results=5)
    search = DuckDuckGoSearchResults(api_wrapper=wrapper)
    return search.run(query)

@tool
def wikipedia_search(query: str) -> str:
    """Search Wikipedia for knowledge."""
    wrapper = WikipediaAPIWrapper()
    return wrapper.run(query)

@tool
def calculate(expression: str) -> str:
    """Evaluate a safe mathematical expression."""
    allowed = set("0123456789+-*/(). ")
    if not all(c in allowed for c in expression):
        return "Invalid characters."
    try:
        return f"Result: {eval(expression)}"
    except Exception as e:
        return f"Error: {e}"

@tool
def execute_python(code: str) -> str:
    """Execute Python code safely in a sandbox subprocess."""
    try:
        with tempfile.NamedTemporaryFile(suffix=".py", delete=True) as f:
            f.write(code.encode())
            f.flush()
            result = subprocess.run(["python3", f.name], capture_output=True, text=True, timeout=10)
            return result.stdout if result.stdout else (f"Error: {result.stderr}" if result.stderr else "Done.")
    except Exception as e:
        return f"Error: {e}"

@tool
def read_file(filepath: str) -> str:
    """Read contents from a local file path."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {e}"

@tool
def get_weather(city: str) -> str:
    """Get current weather details for a given city."""
    api_key = os.getenv("OPENWEATHER_API_KEY")
    if not api_key:
        return "OpenWeather API key not set in .env."
    url = f"http://api.openweathermap.org/data/2.5/weather?q={city}&appid={api_key}&units=metric"
    try:
        resp = requests.get(url).json()
        if resp.get("main"):
            return f"Temperature: {resp['main']['temp']}°C, {resp['weather'][0]['description']}"
        return "City not found."
    except Exception as e:
        return f"Error: {e}"

@tool
def send_email(subject: str, body: str, recipient: str = None) -> str:
    """Send an email notification."""
    if not SENDER_PASSWORD or not SENDER_EMAIL:
        return "❌ Email credentials not set in .env file."
    recipient = recipient or DEFAULT_RECIPIENT
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
def get_crypto_price(symbol: str, vs_currency: str = "usd") -> str:
    """Fetch live crypto prices."""
    symbol = symbol.lower().strip()
    url = f"https://api.coingecko.com/api/v3/simple/price?ids={symbol}&vs_currencies={vs_currency}"
    try:
        data = requests.get(url, timeout=10).json()
        if symbol in data and vs_currency in data[symbol]:
            return f"💰 {symbol.upper()} price: ${data[symbol][vs_currency]:,}"
        return f"❌ Crypto '{symbol}' not found."
    except Exception as e:
        return f"❌ Error: {e}"

@tool
def send_eth(to_address: str, amount_eth: float, chain: str = "ethereum") -> str:
    """Send ETH from your wallet to any address using keys from .env."""
    private_key = os.getenv("PRIVATE_KEY")
    wallet = os.getenv("WALLET_ADDRESS")
    
    if not private_key or not wallet:
        return "❌ PRIVATE_KEY or WALLET_ADDRESS missing from .env."

    rpc_urls = {
        "ethereum": os.getenv("INFURA_URL"),
        "polygon": os.getenv("POLYGON_RPC", "https://polygon-rpc.com"),
        "bsc": os.getenv("BSC_RPC", "https://bsc-dataseed.binance.org/"),
    }
    rpc = rpc_urls.get(chain)
    if not rpc:
        return f"Chain '{chain}' RPC not configured in .env."
    
    w3 = Web3(Web3.HTTPProvider(rpc))
    if not w3.is_connected():
        return "❌ Failed to connect to blockchain node."
    
    try:
        amount_wei = w3.to_wei(amount_eth, 'ether')
        nonce = w3.eth.get_transaction_count(wallet)
        tx = {
            'nonce': nonce,
            'to': w3.to_checksum_address(to_address),
            'value': amount_wei,
            'gas': 21000,
            'gasPrice': w3.eth.gas_price,
            'chainId': w3.eth.chain_id,
        }
        signed = w3.eth.account.sign_transaction(tx, private_key)
        raw_tx = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction")
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        return f"✅ Transaction sent! Hash: {tx_hash.hex()}"
    except Exception as e:
        return f"❌ Transaction failed: {str(e)}"

# =========================================================================
# FASTAPI APP & ENDPOINTS
# =========================================================================
app = FastAPI(title="F.R.I.D.A.Y. Executive Assistant")

class GoalRequest(BaseModel):
    target: float
    deadline_days: int

class ChatRequest(BaseModel):
    message: str

@app.post("/goal")
async def api_set_goal(req: GoalRequest):
    """API endpoint to set a financial target and instantly trigger the autonomous planner."""
    result = goal.set_new_goal(req.target, req.deadline_days)
    generate_plan()  # Connects directly to bot.py to generate tactical operational tasks
    return {"status": "Goal initialized and automated plan generation triggered", **result}

@app.get("/status")
async def api_get_status():
    return goal.get_status_dict()

@app.post("/chat")
async def api_chat(req: ChatRequest):
    result = agent_executor.invoke({"input": req.message})
    return {"reply": result['output']}

# =========================================================================
# LLM AGENT INITIALIZATION
# =========================================================================
if not GROQ_API_KEY:
    raise ValueError("❌ GROQ_API_KEY is missing from environment variables (.env)!")

llm = ChatGroq(model=MODEL, temperature=0.3, groq_api_key=GROQ_API_KEY)

tools_list = [
    web_search, wikipedia_search, calculate, execute_python,
    read_file, get_weather, send_email, get_crypto_price, send_eth
]

memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are F.R.I.D.A.Y., an advanced AI executive assistant with web tools, calculations, and Web3 capabilities."),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

agent = create_tool_calling_agent(llm, tools_list, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools_list, memory=memory, verbose=False)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
