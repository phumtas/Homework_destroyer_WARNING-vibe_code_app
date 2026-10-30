import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(ENV_PATH)

UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"

UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

DEFAULT_MODEL = "gemini-3.8-flash"
SUPPORTED_MODELS = [
    {"id": "gemini-3.8-flash", "name": "Gemini 3.8 Flash (Recommended - Ultra Fast & Smart)", "desc": "Best speed and reasoning for all homework types"},
    {"id": "gemini-3.5-flash-lite", "name": "Gemini 3.5 Flash-Lite (Fast & Cost-Efficient)", "desc": "Lightweight and fastest model for simple Q&A"},
    {"id": "gemini-3.1-pro-preview", "name": "Gemini 3.1 Pro Preview (Complex Reasoning)", "desc": "Deep reasoning for advanced STEM / university problems"}
]
