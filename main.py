# ====================================================================
# ONE MEGA FILE – AI EARNING BOT (F.R.I.D.A.Y. PYTHON ENGINE)
# ====================================================================

import os
import json
import time
import smtplib
import ssl
import subprocess
import tempfile
import requests
import wikipedia
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# LangChain & FastAPI
from langchain.tools import tool
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.memory import ConversationBufferMemory
from langchain_community.tools import DuckDuckGoSearchResults
from langchain_community.utilities import DuckDuckGoSearchAPIWrapper
from langchain_community.utilities import WikipediaAPIWrapper

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
import stripe

# Load environment variables from local .env file
load_dotenv()

# ====================================================================
# CONFIGURATION
# ====================================================================

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "your-openai-api-key-here")
MODEL = "gpt-4o-mini"  # Cost-efficient and fast

SENDER_EMAIL = "ahumuzad077@gmail.com"
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "your-gmail-app-password")
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
DEFAULT_RECIPIENT = os.getenv("DEFAULT_RECIPIENT", "ahumuzad077@gmail.com")

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
YOUR_DOMAIN = "http://localhost:8000"

COST_PER_1K_INPUT = 0.00015
COST_PER_1K_OUTPUT = 0.0006

# ====================================================================
# TOOLS
# ====================================================================

@tool
def web_search(query: str) -> str:
    """Search the web for current information."""
    wrapper = DuckDuckGoSearchAPIWrapper(max_results=5)
    search = DuckDuckGoSearchResults(api_wrapper=wrapper)
    return search.run(query)

@tool
def wikipedia_search(query: str) -> str:
    """Search Wikipedia for a topic."""
    wrapper = WikipediaAPIWrapper()
    return wrapper.run(query)

@tool
def calculate(expression: str) -> str:
    """Evaluate a mathematical expression (safe subset)."""
    allowed = set("0123456789+-*/(). ")
    if not all(c in allowed for c in expression):
        return "Invalid characters in expression."
    try:
        result = eval(expression)
        return f"Result: {result}"
    except Exception as e:
        return f"Error: {str(e)}"

@tool
def execute_python(code: str) -> str:
    """Run a Python snippet and return its stdout."""
    try:
        with tempfile.NamedTemporaryFile(suffix=".py", delete=True, mode="w", encoding="utf-8") as f:
            f.write(code)
            f.flush()
            result = subprocess.run(
                ["python3", f.name],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.stdout:
                return result.stdout
            elif result.stderr:
                return f"Error: {result.stderr}"
            else:
                return "Code executed successfully (no output)."
    except subprocess.TimeoutExpired:
        return "Execution timed out."
    except Exception as e:
        return f"Error: {str(e)}"

@tool
def read_file(filepath: str) -> str:
    """Read contents of a text file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {str(e)}"

@tool
def get_weather(city: str) -> str:
    """Get current weather for a city (requires OPENWEATHER_API_KEY)."""
    api_key = os.getenv("OPENWEATHER_API_KEY")
    if not api_key:
        return "OpenWeather API key not set."
    url = f"http://api.openweathermap.org/data/2.5/weather?q={city}&appid={api_key}&units=metric"
    try:
        resp = requests.get(url, timeout=10)
        data = resp.json()
        if data.get("main"):
            temp = data["main"]["temp"]
            desc = data["weather"][0]["description"]
            return f"Temperature: {temp}°C, {desc}"
        else:
            return "City not found."
    except Exception as e:
        return f"Error: {str(e)}"

@tool
def post_to_wordpress(title: str, content: str, status: str = "draft") -> str:
    """Create a new post on your WordPress site. Requires WP_URL, WP_USERNAME, WP_APP_PASSWORD in .env."""
    wp_url = os.getenv("WP_URL")
    username = os.getenv("WP_USERNAME")
    password = os.getenv("WP_APP_PASSWORD")
    if not all([wp_url, username, password]):
        return "WordPress credentials missing in .env"
    endpoint = f"{wp_url}/wp-json/wp/v2/posts"
    auth = (username, password)
    data = {"title": title, "content": content, "status": status}
    try:
        response = requests.post(endpoint, json=data, auth=auth, timeout=15)
        if response.status_code in (201, 200):
            post_id = response.json().get("id")
            return f"Post published successfully! ID: {post_id}"
        else:
            return f"WordPress error: {response.status_code} - {response.text}"
    except Exception as e:
        return f"Error posting to WordPress: {str(e)}"

@tool
def send_email(subject: str, body: str, recipient: str = None) -> str:
    """Send an email via SMTP. Uses DEFAULT_RECIPIENT if not specified."""
    if not SENDER_PASSWORD or SENDER_PASSWORD == "your-gmail-app-password":
        return "❌ Email password not set in environment variables."
    if recipient is None:
        recipient = DEFAULT_RECIPIENT
    if not recipient:
        return "No recipient provided."

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
        return f"✅ Email sent successfully to {recipient}"
    except Exception as e:
        return f"❌ Failed to send email: {str(e)}"

@tool
def get_crypto_price(symbol: str, vs_currency: str = "usd") -> str:
    """Get the current price of a cryptocurrency (e.g., bitcoin, ethereum, solana)."""
    symbol = symbol.lower().strip()
    url = f"https://api.coingecko.com/api/v3/simple/price?ids={symbol}&vs_currencies={vs_currency}"
    try:
        response = requests.get(url, timeout=10)
        data = response.json()
        if symbol in data and vs_currency in data[symbol]:
            price = data[symbol][vs_currency]
            return f"💰 {symbol.upper()} price: ${price:,} {vs_currency.upper()}"
        else:
            return f"❌ Crypto '{symbol}' not found."
    except Exception as e:
        return f"❌ Error fetching crypto price: {str(e)}"

# ====================================================================
# COST TRACKER
# ====================================================================
class CostTracker:
    def __init__(self):
        self.total_cost = 0.0
        self.usage_log = []
    def add_usage(self, prompt_tokens, completion_tokens):
        input_cost = (prompt_tokens / 1000) * COST_PER_1K_INPUT
        output_cost = (completion_tokens / 1000) * COST_PER_1K_OUTPUT
        call_cost = input_cost + output_cost
        self.total_cost += call_cost
        self.usage_log.append({
            "timestamp": datetime.now().isoformat(),
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "cost": round(call_cost, 6)
        })
        return call_cost

tracker = CostTracker()

# ====================================================================
# LLM & AGENT SETUP
# ====================================================================
llm = ChatOpenAI(model=MODEL, temperature=0.3, api_key=OPENAI_API_KEY)

tools = [
    web_search,
    wikipedia_search,
    calculate,
    execute_python,
    read_file,
    get_weather,
    post_to_wordpress,
    send_email,
    get_crypto_price,
]

memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful AI executive assistant. Be concise, direct, and thorough."),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

agent = create_tool_calling_agent(llm, tools, prompt)
agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    memory=memory,
    verbose=False,
    max_iterations=5,
    handle_parsing_errors=True
)

# ====================================================================
# FASTAPI APP
# ====================================================================
app = FastAPI(title="AI Earning Bot", description="Autonomous Executive Assistant Core")

class ChatRequest(BaseModel):
    message: str
    user_id: str = "default"

class ChatResponse(BaseModel):
    reply: str
    cost_usd: float
    total_spent_usd: float

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        result = agent_executor.invoke({"input": request.message})
        prompt_tokens = int(len(request.message.split()) * 1.3)
        completion_tokens = int(len(result['output'].split()) * 1.3)
        cost = tracker.add_usage(prompt_tokens, completion_tokens)
        return ChatResponse(
            reply=result['output'],
            cost_usd=round(cost, 6),
            total_spent_usd=round(tracker.total_cost, 6)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats")
async def stats():
    return {
        "total_spent_usd": round(tracker.total_cost, 6),
        "total_calls": len(tracker.usage_log),
        "memory_length": len(memory.chat_memory.messages)
    }

@app.post("/reset_memory")
async def reset():
    memory.clear()
    return {"status": "Memory reset successfully"}

# Stripe Webhooks / Checkout
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

    @app.post("/create-checkout-session")
    async def create_checkout_session():
        try:
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[{
                    "price_data": {
                        "currency": "usd",
                        "product_data": {"name": "AI Bot - 100 Query Package"},
                        "unit_amount": 1000,
                    },
                    "quantity": 1,
                }],
                mode="payment",
                success_url=f"{YOUR_DOMAIN}/success?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{YOUR_DOMAIN}/cancel",
            )
            return {"checkout_url": session.url}
        except Exception as e:
            raise HTTPException(status_0=400, detail=str(e))

# ====================================================================
# BACKGROUND SCHEDULER
# ====================================================================
scheduler = BackgroundScheduler()

def auto_crypto_price_check():
    print(f"[{datetime.now()}] Running background crypto price check...")
    try:
        btc = get_crypto_price.invoke({"symbol": "bitcoin"})
        eth = get_crypto_price.invoke({"symbol": "ethereum"})
        sol = get_crypto_price.invoke({"symbol": "solana"})
        
        summary = f"📊 Automated Crypto Snapshot - {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n{btc}\n{eth}\n{sol}\n"
        send_email.invoke({
            "subject": f"📈 Crypto Snapshot - {datetime.now().strftime('%H:%M')}",
            "body": summary
        })
    except Exception as e:
        print(f"Scheduler job error: {e}")

scheduler.add_job(auto_crypto_price_check, "interval", hours=1)
scheduler.start()

# ====================================================================
# SERVER EXECUTION
# ====================================================================
if __name__ == "__main__":
    import uvicorn
    print("🚀 F.R.I.D.A.Y. Python Engine is launching on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
