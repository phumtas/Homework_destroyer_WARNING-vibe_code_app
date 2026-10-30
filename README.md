# ⚡ Homework Destroyer - AI Homework Assistant

An AI-powered desktop & web application designed to solve worksheets and homework with fill-in-the-blank questions (such as `......`, `____`, `[ ]`, `( )`). It implements an automated self-correction verification loop and exports completed assignments back to **.docx** and **.pdf**.

---

## 🎯 Architecture & Flowchart Implementation

The application precisely implements the provided architecture flowchart:

```
[Start / เริ่ม]
      │
      ▼
┌──────────────┐
│  if .doc/.pdf│
└──────┬───────┘
       ├──> [.docx / .doc] ──> [python-docx] ──┐
       └──> [.pdf]         ──> [pypdf]       ──┤
                                               ▼
                                      [Input to Gemini LLM]
                                               │
                                               ▼
                             [Detect & Clean Blanks: "......", "___"]
                                               │
                                               ▼
                                      [Generate Answers]
                                               │
                                               ▼
                                  ┌── [Verify Answer / ตรวจสอบ] ◄──┐
                                  │   (Max 2 Retry Rounds if wrong) │
                                  │                                │
                                  ├── Incorrect (ผิด) ─────────────┘
                                  ▼
                              Correct (ถูก)
                                  │
                                  ▼
                            [Insert Answers]
                                  │
                                  ▼
                       [Export .docx / .pdf]
                                  │
                                  ▼
                             [End / จบ]
```

---

## ✨ Features

- **Drag & Drop File System**:
  - Drag and drop `.docx`, `.pdf`, or `.doc` files directly into the window.
  - Automatic document parsing (`python-docx` for Word, `pypdf` for PDF).
  - Instant text length, paragraph count, and preview snippet extraction.
- **LLM API Integration**:
  - Supports **Gemini API** via the official `google-genai` SDK.
  - Model choices:
    - `gemini-3.8-flash` (Recommended — Ultra-fast, highly accurate)
    - `gemini-3.5-flash-lite` (Lightweight & high throughput)
    - `gemini-3.1-pro-preview` (Advanced STEM & multi-step reasoning)
  - In-app key tester & `.env` storage.
- **Automated Verification Loop ("ผิด Max 2 รอบ")**:
  - The model verifies its own answers against question constraints and grammar.
  - If any inaccuracy is found, it automatically revises the answer (up to 2 rounds) before inserting.
- **Window Minimization**:
  - **Desktop Native Window**: PyWebView window provides standard Windows titlebar with native `_` Minimize, `□` Maximize, and `✕` Close.
  - **In-App Titlebar Minimize**: Click the `_` button on the webapp header to minimize native window, or collapse into a floating mini-widget in the corner of your screen!
  - **Restore anytime**: Click the floating mini-widget to restore full view.
- **Multi-Format Export**:
  - 1-Click download of solved **.docx** (with highlighted answers in blue/green and summary answer key).
  - 1-Click download of solved **.pdf** with clean typography and verification report table.

---

## 🚀 Quick Start

### 1. Launch with One Click
Double-click `run.bat` in this folder:
```cmd
run.bat
```

### 2. Launch via Terminal
Using the bundled virtual environment:
```powershell
.\.venv\Scripts\python.exe app.py
```

To run specifically in web browser mode:
```powershell
.\.venv\Scripts\python.exe app.py --web
```

---

## 📂 Project Structure

```
E:\Homework destroyer - [the webapp project]\
├── .venv/                         # Configured Python 3.14 virtual environment
├── requirements.txt               # All installed dependencies
├── run.bat                        # 1-Click Windows launcher
├── app.py                         # FastAPI backend & PyWebView desktop window launcher
├── config.py                      # Application configuration & .env loader
├── core/
│   ├── document_parser.py         # python-docx and pypdf parser
│   ├── llm_solver.py              # Gemini LLM blank detection, solving & verification loop
│   └── exporter.py                # Generates solved .docx and .pdf output files
├── static/
│   ├── index.html                 # Modern glassmorphism single-page app
│   ├── css/
│   │   └── style.css              # Custom dark-mode styles, responsive layout & animations
│   └── js/
│   └── app.js                 # Drag & drop handling, stepper, and minimize controls
├── sample_homework/               # Ready-to-use sample test files
│   ├── sample_homework.docx
│   └── sample_homework.pdf
├── uploads/                       # Temporary uploaded files
└── outputs/                       # Generated solved homework files (.docx and .pdf)
```

---

## 🧪 Testing with Sample Files

Try dragging and dropping the provided test files from `sample_homework/`:
- `sample_homework\sample_homework.docx`
- `sample_homework\sample_homework.pdf`
