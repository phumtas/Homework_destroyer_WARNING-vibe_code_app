import os
import sys
import uuid
import shutil
import logging
import threading
import argparse
import webbrowser
from pathlib import Path
from typing import Optional, Dict, Any

import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import UPLOAD_DIR, OUTPUT_DIR, DEFAULT_MODEL, SUPPORTED_MODELS, ENV_PATH
from core.document_parser import DocumentParser
from core.llm_solver import LLMHomeworkSolver
from core.exporter import DocumentExporter

logging.basicConfig(level=logging.INFO, format="%(asctime)s - [%(levelname)s] - %(message)s")
logger = logging.getLogger("HomeworkDestroyer")

app = FastAPI(title="Homework Destroyer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# In-memory storage for active job states
JOB_CACHE: Dict[str, Any] = {}

class KeyCheckRequest(BaseModel):
    api_key: str
    model: Optional[str] = DEFAULT_MODEL

class SaveKeyRequest(BaseModel):
    api_key: str

@app.get("/")
def get_index():
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="index.html not found.")
    return FileResponse(index_file)

@app.get("/api/models")
def get_available_models():
    saved_key = os.environ.get("GEMINI_API_KEY", "")
    return {
        "models": SUPPORTED_MODELS,
        "default": DEFAULT_MODEL,
        "has_saved_key": bool(saved_key)
    }

@app.post("/api/check-key")
def check_api_key(req: KeyCheckRequest):
    api_key = req.api_key.strip() or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return {"success": False, "error": "Please provide a Gemini API key."}
    solver = LLMHomeworkSolver(api_key=api_key, model_name=req.model or DEFAULT_MODEL)
    return solver.test_connection()

@app.post("/api/save-key")
def save_api_key(req: SaveKeyRequest):
    key = req.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="API Key cannot be empty.")
    
    os.environ["GEMINI_API_KEY"] = key
    try:
        with open(ENV_PATH, "w", encoding="utf-8") as f:
            f.write(f"GEMINI_API_KEY={key}\n")
        return {"success": True, "message": "API Key saved successfully to .env!"}
    except Exception as e:
        return {"success": False, "error": f"Failed to save .env: {str(e)}"}

@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Step 1 in flowchart:
    Drag-and-drop or select file -> Branch:
    - .doc / .docx -> use python-docx
    - .pdf -> use pypdf
    """
    ext = Path(file.filename).suffix.lower()
    if ext not in [".pdf", ".docx", ".doc"]:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file extension. Please upload a .pdf, .docx, or .doc file."
        )

    file_id = str(uuid.uuid4())[:8]
    safe_name = f"{file_id}_{file.filename}"
    saved_path = UPLOAD_DIR / safe_name

    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        parsed_doc = DocumentParser.parse(str(saved_path))
    except Exception as e:
        logger.error(f"Error parsing document: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to parse document: {str(e)}")

    preview_snippet = parsed_doc.get("preview_text", parsed_doc.get("full_text", "")[:800])

    return {
        "success": True,
        "file_id": file_id,
        "file_name": file.filename,
        "safe_path": str(saved_path),
        "file_type": parsed_doc.get("file_type"),
        "total_paragraphs": parsed_doc.get("total_paragraphs", 0),
        "total_pages": parsed_doc.get("total_pages", 0),
        "preview_text": preview_snippet,
        "full_text_length": len(parsed_doc.get("full_text", ""))
    }

@app.post("/api/solve")
async def solve_homework(
    file_id: str = Form(...),
    file_name: str = Form(...),
    safe_path: str = Form(...),
    api_key: str = Form(""),
    model: str = Form(DEFAULT_MODEL),
    custom_instructions: str = Form("")
):
    """
    Step 2-5 in flowchart:
    1. Parse document (python-docx for Word, pypdf + PDF bytes for Multimodal Vision)
    2. Input to LLM -> LLM detects/cleans blanks & interprets maps/tables
    3. LLM generates answers
    4. Verification step (ตรวจสอบคำตอบ) -> Retry if wrong (Max 2 retries)
    5. Output files (.docx and .pdf)
    """
    effective_key = api_key.strip() or os.environ.get("GEMINI_API_KEY", "")
    if not effective_key:
        raise HTTPException(
            status_code=400,
            detail="Gemini API Key is required. Please enter your Gemini API key in the settings card on the right."
        )

    if not os.path.exists(safe_path):
        raise HTTPException(status_code=404, detail="Uploaded file could not be found.")

    # 1. Parse document
    try:
        parsed_doc = DocumentParser.parse(safe_path)
    except Exception as e:
        logger.error(f"Error parsing document: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to parse document: {str(e)}")

    # 2. Initialize LLM solver
    try:
        solver = LLMHomeworkSolver(api_key=effective_key, model_name=model)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid solver configuration: {str(e)}")

    # 3. Run solver pipeline with multimodal vision & verification
    try:
        result = solver.solve_pipeline(
            document_info=parsed_doc,
            custom_instructions=custom_instructions
        )
    except Exception as e:
        logger.error(f"Error in solve_pipeline: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI Solving failed: {str(e)}")

    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Solving failed."))

    solved_items = result.get("items", [])

    # 4. Export results to .docx and .pdf
    base_name = Path(file_name).stem
    out_docx_name = f"Solved_{base_name}_{file_id}.docx"
    out_pdf_name = f"Solved_{base_name}_{file_id}.pdf"

    out_docx_path = OUTPUT_DIR / out_docx_name
    out_pdf_path = OUTPUT_DIR / out_pdf_name

    DocumentExporter.export_docx(safe_path, solved_items, str(out_docx_path))
    DocumentExporter.export_pdf(file_name, solved_items, str(out_pdf_path))

    return {
        "success": True,
        "file_name": file_name,
        "total_questions": len(solved_items),
        "items": solved_items,
        "downloads": {
            "docx": f"/api/download/{out_docx_name}",
            "pdf": f"/api/download/{out_pdf_name}"
        }
    }

@app.get("/api/download/{filename}")
def download_file(filename: str):
    file_path = OUTPUT_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found or expired.")
    return FileResponse(
        file_path,
        filename=filename,
        media_type="application/octet-stream"
    )

# PyWebView GUI controller & minimize support
class DesktopAPI:
    def __init__(self, window):
        self.window = window

    def minimize(self):
        if self.window:
            self.window.minimize()

    def toggle_fullscreen(self):
        if self.window:
            self.window.toggle_fullscreen()

    def close(self):
        if self.window:
            self.window.destroy()

def start_server(port: int = 7860):
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")

def main():
    parser = argparse.ArgumentParser(description="Homework Destroyer - AI Homework Assistant")
    parser.add_argument("--web", action="store_true", help="Launch in default web browser instead of desktop window")
    parser.add_argument("--port", type=int, default=7860, help="Port to run server on")
    args = parser.parse_args()

    port = args.port
    server_url = f"http://127.0.0.1:{port}"

    # Start FastAPI server in background thread
    server_thread = threading.Thread(target=start_server, args=(port,), daemon=True)
    server_thread.start()

    logger.info(f"Homework Destroyer server listening on {server_url}")

    if args.web:
        print(f"\n[Homework Destroyer] Running in Web Mode. Opening {server_url} in browser...")
        webbrowser.open(server_url)
        server_thread.join()
    else:
        try:
            import webview
            print(f"\n[Homework Destroyer] Launching Desktop GUI Window...")
            window = webview.create_window(
                title="Homework Destroyer - AI Homework Assistant",
                url=server_url,
                width=1280,
                height=880,
                min_size=(900, 650),
                confirm_close=True,
                background_color="#0f172a"
            )
            api = DesktopAPI(window)
            window.expose(api.minimize, api.toggle_fullscreen, api.close)
            webview.start()
        except Exception as e:
            logger.warning(f"PyWebView desktop window could not start ({e}). Falling back to web browser...")
            webbrowser.open(server_url)
            server_thread.join()

if __name__ == "__main__":
    main()
