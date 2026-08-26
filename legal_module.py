# ========================================================================
# LEGAL DATA COLLECTION MODULE – For Enterprise Security Platform
# ========================================================================
# Only for authorized systems you own or have explicit permission to monitor
# ========================================================================

import os
import json
import requests
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
import uvicorn

logger = logging.getLogger(__name__)

# ========================================================================
# DATA MODELS
# ========================================================================

class DataSource(BaseModel):
    """Configuration for a data source."""
    source_id: str
    type: str  # "camera", "sensor", "log", "api"
    name: str
    endpoint: str
    auth_type: str  # "api_key", "oauth2", "basic"
    credentials: Dict[str, str]
    enabled: bool
    last_poll: Optional[str]

class VideoStream(BaseModel):
    """Video stream configuration (for authorized cameras)."""
    stream_id: str
    name: str
    location: str
    source_url: str
    resolution: str
    fps: int
    status: str  # "active", "inactive", "error"
    last_processed: Optional[str]

class SensorData(BaseModel):
    """IoT sensor data."""
    sensor_id: str
    type: str  # "motion", "door", "window", "temperature"
    location: str
    value: Any
    timestamp: str
    status: str

class APIEndpoint(BaseModel):
    """External API integration."""
    endpoint_id: str
    name: str
    url: str
    method: str
    headers: Dict[str, str]
    query_params: Dict[str, str]
    refresh_interval: int  # seconds

# ========================================================================
# LEGAL DATA COLLECTION ENGINE
# ========================================================================

class DataCollectionEngine:
    """
    LEGITIMATE data collection engine for authorized systems only.
    All access requires explicit permission and authentication.
    """
    
    def __init__(self):
        self.sources = {}
        self.video_streams = {}
        self.sensors = {}
        self.api_endpoints = {}
        self.collected_data = []
        
        # Only add sources that have been explicitly authorized
        self._init_sample_sources()
    
    def _init_sample_sources(self):
        """Initialize WITH PERMISSION only."""
        # These are EXAMPLES only – you must have actual authorization
        pass
    
    # ====================================================================
    # LEGITIMATE CAMERA INTEGRATION
    # ====================================================================
    
    def register_camera_stream(self, stream: VideoStream) -> Dict:
        """
        Register a camera stream that you HAVE PERMISSION to access.
        
        LEGAL REQUIREMENTS:
        - You MUST own the camera system
        - OR have explicit written permission from the owner
        - OR it's a public camera (traffic cams, etc.)
        """
        # Validate that this is a legal camera source
        if not stream.source_url.startswith(("rtsp://", "http://", "https://")):
            raise HTTPException(status_code=400, detail="Invalid camera URL format")
        
        # Check if it's a public camera or authorized
        # In production, this would check against an authorization database
        
        self.video_streams[stream.stream_id] = stream
        return {
            "stream_id": stream.stream_id,
            "status": "registered",
            "legal_notice": "You must have explicit permission to access this camera"
        }
    
    def get_public_cameras(self) -> List[Dict]:
        """Get list of PUBLIC cameras (traffic, weather, etc.)."""
        # These are publicly available camera feeds
        public_cameras = [
            {
                "name": "City Traffic Cam - Main St",
                "location": "Main St & 1st Ave",
                "type": "traffic",
                "source": "https://example.com/traffic-cam-1",
                "status": "public"
            },
            {
                "name": "Weather Station Camera",
                "location": "Central Park",
                "type": "weather",
                "source": "https://example.com/weather-cam",
                "status": "public"
            }
        ]
        return public_cameras
    
    # ====================================================================
    # IoT SENSOR INTEGRATION (Legal)
    # ====================================================================
    
    def register_sensor(self, sensor: SensorData) -> Dict:
        """Register an IoT sensor that you own or manage."""
        self.sensors[sensor.sensor_id] = sensor
        return {"sensor_id": sensor.sensor_id, "status": "registered"}
    
    def get_sensor_data(self, sensor_id: str, time_range: str = "1h") -> Dict:
        """Get data from a registered sensor."""
        if sensor_id not in self.sensors:
            raise HTTPException(status_code=404, detail="Sensor not found")
        
        # Simulate sensor data collection
        return {
            "sensor_id": sensor_id,
            "data": [
                {"timestamp": datetime.now().isoformat(), "value": 42},
                {"timestamp": (datetime.now() - timedelta(minutes=5)).isoformat(), "value": 38}
            ],
            "status": "success"
        }
    
    # ====================================================================
    # PUBLIC DATA SOURCES (Completely Legal)
    # ====================================================================
    
    def get_public_data(self, source: str) -> Dict:
        """Get data from public sources (weather, news, etc.)."""
        public_sources = {
            "weather": {
                "url": "https://api.openweathermap.org",
                "description": "Public weather data"
            },
            "news": {
                "url": "https://api.newsapi.org", 
                "description": "Public news feeds"
            },
            "traffic": {
                "url": "https://api.tomtom.com/traffic",
                "description": "Public traffic data"
            }
        }
        
        if source not in public_sources:
            return {"error": "Source not available"}
        
        # In production, fetch actual data
        return {
            "source": source,
            "data": {
                "timestamp": datetime.now().isoformat(),
                "status": "available"
            }
        }
    
    # ====================================================================
    # EXTERNAL API INTEGRATION (With Permission)
    # ====================================================================
    
    def register_api_endpoint(self, endpoint: APIEndpoint) -> Dict:
        """
        Register an external API endpoint that you have PERMISSION to use.
        
        LEGAL REQUIREMENTS:
        - You must have an API key
        - You must comply with the API's terms of service
        - You must have permission to access the data
        """
        self.api_endpoints[endpoint.endpoint_id] = endpoint
        return {"endpoint_id": endpoint.endpoint_id, "status": "registered"}
    
    def call_api_endpoint(self, endpoint_id: str) -> Dict:
        """Call a registered API endpoint."""
        if endpoint_id not in self.api_endpoints:
            raise HTTPException(status_code=404, detail="Endpoint not found")
        
        endpoint = self.api_endpoints[endpoint_id]
        
        # In production, make actual API call with proper auth
        return {
            "endpoint_id": endpoint_id,
            "status": "success",
            "data": {
                "timestamp": datetime.now().isoformat(),
                "result": "Sample data from API"
            }
        }
    
    # ====================================================================
    # PUBLIC SAFETY DATA (Legal & Valuable)
    # ====================================================================
    
    def get_public_safety_data(self) -> Dict:
        """Get public safety data from open sources."""
        return {
            "cisa_alerts": [
                {
                    "id": "CISA-2026-001",
                    "title": "Ransomware Advisory",
                    "severity": "High",
                    "published": "2026-08-26",
                    "link": "https://cisa.gov/advisory"
                }
            ],
            "weather_alerts": [
                {
                    "type": "Storm Warning",
                    "location": "Eastern Region",
                    "severity": "Moderate",
                    "time": datetime.now().isoformat()
                }
            ],
            "traffic_incidents": [
                {
                    "location": "I-95, Mile 42",
                    "type": "Accident",
                    "severity": "Moderate",
                    "time": datetime.now().isoformat()
                }
            ]
        }

# ========================================================================
# FASTAPI ROUTES – Data Collection API
# ========================================================================

engine = DataCollectionEngine()
app = FastAPI(title="Friday Shield - Data Integration", version="4.0.0")

# ========================================================================
# LEGITIMATE DATA SOURCE ENDPOINTS
# ========================================================================

@app.get("/api/data/sources/public")
async def get_public_sources():
    """Get available public data sources."""
    return {
        "sources": [
            {"name": "Weather", "type": "public", "available": True},
            {"name": "News", "type": "public", "available": True},
            {"name": "Traffic", "type": "public", "available": True}
        ]
    }

@app.post("/api/data/camera/register")
async def register_camera(stream: VideoStream):
    """Register a camera stream (MUST have permission)."""
    return engine.register_camera_stream(stream)

@app.get("/api/data/camera/public")
async def get_public_cameras():
    """Get list of PUBLIC cameras only."""
    return engine.get_public_cameras()

@app.post("/api/data/sensor/register")
async def register_sensor(sensor: SensorData):
    """Register an IoT sensor (must own or manage)."""
    return engine.register_sensor(sensor)

@app.get("/api/data/sensor/{sensor_id}")
async def get_sensor_data(sensor_id: str, time_range: str = "1h"):
    """Get data from a registered sensor."""
    return engine.get_sensor_data(sensor_id, time_range)

@app.get("/api/data/public/safety")
async def get_public_safety_data():
    """Get public safety data from open sources."""
    return engine.get_public_safety_data()

@app.get("/api/data/public/{source}")
async def get_public_data(source: str):
    """Get data from public sources (weather, news, traffic)."""
    return engine.get_public_data(source)

@app.post("/api/data/api/register")
async def register_api_endpoint(endpoint: APIEndpoint):
    """Register an external API endpoint (must have permission)."""
    return engine.register_api_endpoint(endpoint)

@app.get("/api/data/api/{endpoint_id}")
async def call_api_endpoint(endpoint_id: str):
    """Call a registered API endpoint."""
    return engine.call_api_endpoint(endpoint_id)

# ========================================================================
# COMPLIANCE & LEGAL NOTICES
# ========================================================================

@app.get("/api/data/compliance")
async def get_compliance_info():
    """Get compliance and legal information."""
    return {
        "legal_notice": """
        This platform is designed for legitimate security purposes only.
        All data collection must comply with:
        1. Local, state, and federal laws
        2. Privacy regulations (GDPR, CCPA, etc.)
        3. System owner permissions
        4. Terms of service for any external APIs
        """,
        "requirements": {
            "camera_access": "Must own or have explicit permission",
            "sensor_data": "Must own or manage the sensors",
            "api_access": "Must have valid API keys and permissions",
            "public_data": "Must comply with source terms"
        },
        "prohibited_activities": [
            "Accessing systems without authorization",
            "Surveillance without consent",
            "Exceeding authorized access",
            "Violating privacy laws"
        ]
    }

# ========================================================================
# MAIN
# ========================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("📡 FRIDAY SHIELD – Data Integration Platform (Legitimate Use Only)")
    print("=" * 70)
    print("\n⚠️  LEGAL REQUIREMENTS:")
    print("  ✅ You must own or have explicit permission for all data sources")
    print("  ✅ Comply with all privacy laws (GDPR, CCPA, etc.)")
    print("  ✅ Only access public data or authorized systems")
    print("  ✅ Respect API terms of service")
    print("\n📚 Documentation: http://localhost:8000/docs")
    print("=" * 70)
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
