/**
 * Homework Destroyer - Frontend Logic & Drag-and-Drop Controller
 */

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const filePreviewCard = document.getElementById("filePreviewCard");
  const fileNameEl = document.getElementById("fileName");
  const fileSizeEl = document.getElementById("fileSize");
  const fileStatsEl = document.getElementById("fileStats");
  const fileTypeBadge = document.getElementById("fileTypeBadge");
  const btnRemoveFile = document.getElementById("btnRemoveFile");
  const snippetPreviewBox = document.getElementById("snippetPreviewBox");
  const snippetText = document.getElementById("snippetText");

  const apiKeyInput = document.getElementById("apiKeyInput");
  const btnToggleKeyVisibility = document.getElementById("btnToggleKeyVisibility");
  const modelSelect = document.getElementById("modelSelect");
  const keyStatusBadge = document.getElementById("keyStatusBadge");
  const btnTestKey = document.getElementById("btnTestKey");
  const btnSaveKey = document.getElementById("btnSaveKey");

  const customInstructions = document.getElementById("customInstructions");
  const btnStartSolve = document.getElementById("btnStartSolve");
  const solveBtnIcon = document.getElementById("solveBtnIcon");
  const solveBtnText = document.getElementById("solveBtnText");

  const progressPanel = document.getElementById("progressPanel");
  const progressBarFill = document.getElementById("progressBarFill");
  const progressMessage = document.getElementById("progressMessage");
  const progressPercent = document.getElementById("progressPercent");

  const resultsSection = document.getElementById("resultsSection");
  const questionCardsList = document.getElementById("questionCardsList");
  const btnDownloadDocx = document.getElementById("btnDownloadDocx");
  const btnDownloadPdf = document.getElementById("btnDownloadPdf");
  const btnCopyAnswers = document.getElementById("btnCopyAnswers");

  const btnMinimize = document.getElementById("btnMinimize");
  const btnCompactMode = document.getElementById("btnCompactMode");
  const btnFullscreen = document.getElementById("btnFullscreen");
  const btnResetApp = document.getElementById("btnResetApp");
  const miniDockWidget = document.getElementById("miniDockWidget");
  const appMainContainer = document.getElementById("appMainContainer");
  const windowTitlebar = document.getElementById("windowTitlebar");

  // State
  let currentFile = null;
  let uploadResponse = null;
  let solvedResults = null;

  // Initialize
  initApp();

  async function initApp() {
    // Load local storage API key if available
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) {
      apiKeyInput.value = savedKey;
      setKeyStatus("Saved Locally", "success");
    }

    try {
      const res = await fetch("/api/models");
      const data = await res.json();
      if (data.has_saved_key && !apiKeyInput.value) {
        setKeyStatus(".env Key Active", "success");
      }
    } catch (e) {
      console.warn("Could not check server models", e);
    }

    setupDragAndDrop();
    setupEventListeners();
  }

  function setKeyStatus(text, statusType) {
    keyStatusBadge.textContent = text;
    keyStatusBadge.className = `status-badge ${statusType}`;
  }

  // --------------------------------------------------------------------------
  // Drag and Drop & File Upload Handling
  // --------------------------------------------------------------------------
  function setupDragAndDrop() {
    dropzone.addEventListener("click", () => fileInput.click());

    dropzone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInput.click();
      }
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove("dragover");
      });
    });

    dropzone.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        handleFileSelection(files[0]);
      }
    });

    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        handleFileSelection(e.target.files[0]);
      }
    });

    btnRemoveFile.addEventListener("click", resetFileSelection);
  }

  async function handleFileSelection(file) {
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (![".pdf", ".docx", ".doc"].includes(ext)) {
      alert("Unsupported file format! Please select a .docx, .pdf, or .doc file.");
      return;
    }

    currentFile = file;
    dropzone.style.display = "none";
    filePreviewCard.classList.add("active");

    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = formatBytes(file.size);
    fileStatsEl.textContent = "Uploading & Analyzing...";

    fileTypeBadge.textContent = ext.replace(".", "").toUpperCase();
    fileTypeBadge.className = `file-type-badge ${ext === ".pdf" ? "pdf" : "docx"}`;

    // Highlight Step 1
    highlightStep("step-upload");

    // Perform Upload
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Upload failed");
      }

      uploadResponse = await res.json();

      // Update file stats
      if (uploadResponse.file_type === "pdf") {
        fileStatsEl.textContent = `PDF Document (${uploadResponse.total_pages} pages parsed via pypdf)`;
        highlightStep("step-branch");
      } else {
        fileStatsEl.textContent = `Word Document (${uploadResponse.total_paragraphs} paragraphs parsed via python-docx)`;
        highlightStep("step-branch");
      }

      // Show snippet
      if (uploadResponse.preview_text) {
        snippetPreviewBox.style.display = "block";
        snippetText.textContent = uploadResponse.preview_text;
      }

      btnStartSolve.disabled = false;
      btnStartSolve.focus();

    } catch (err) {
      console.error(err);
      alert(`Error processing file: ${err.message}`);
      resetFileSelection();
    }
  }

  function resetFileSelection() {
    currentFile = null;
    uploadResponse = null;
    fileInput.value = "";
    filePreviewCard.classList.remove("active");
    dropzone.style.display = "block";
    snippetPreviewBox.style.display = "none";
    btnStartSolve.disabled = true;
    resetFlowSteps();
    resultsSection.classList.remove("active");
  }

  function formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  // --------------------------------------------------------------------------
  // Flowchart Step Highlighter
  // --------------------------------------------------------------------------
  function highlightStep(stepId) {
    const steps = [
      "step-upload", "step-branch", "step-blanks", 
      "step-generate", "step-verify", "step-insert", "step-export"
    ];
    let reached = false;
    steps.forEach((s) => {
      const el = document.getElementById(s);
      if (s === stepId) {
        el.className = "flow-step active";
        reached = true;
      } else if (!reached) {
        el.className = "flow-step completed";
      } else {
        el.className = "flow-step";
      }
    });
  }

  function resetFlowSteps() {
    highlightStep("step-upload");
  }

  // --------------------------------------------------------------------------
  // Homework Solving Pipeline
  // --------------------------------------------------------------------------
  async function startSolvingPipeline() {
    if (!uploadResponse) return;

    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;
    const instructions = customInstructions.value.trim();

    if (!apiKey) {
      apiKeyInput.focus();
      apiKeyInput.style.borderColor = "var(--accent-rose)";
      apiKeyInput.style.boxShadow = "0 0 15px rgba(244, 63, 94, 0.4)";
      setTimeout(() => {
        apiKeyInput.style.borderColor = "";
        apiKeyInput.style.boxShadow = "";
      }, 3000);
      alert("กรุณากรอก Gemini API Key ในกล่อง Gemini LLM Config ทางขวามือก่อนเริ่มประมวลผลครับ\n(Please enter your Gemini API Key in the settings box on the right first!)");
      return;
    }

    // Disable button & show progress
    btnStartSolve.disabled = true;
    solveBtnIcon.textContent = "⏳";
    solveBtnText.textContent = "Solving & Verifying...";
    progressPanel.classList.add("active");
    resultsSection.classList.remove("active");

    // --- Smooth animated progress simulation ---
    // Instead of fixed setTimeout timers that freeze at 70%, we use
    // requestAnimationFrame to smoothly fill from 20% → 88% while the
    // API call runs.  Step labels update at key thresholds.
    let simulatedPercent = 20;
    let progressRunning = true;

    const stepThresholds = [
      { pct: 20,  label: "Step 3: Analyzing visual document & detecting questions/blanks...",         step: "step-blanks"   },
      { pct: 35,  label: "Step 4: Gemini Multimodal AI generating high-confidence answers...",        step: "step-generate" },
      { pct: 55,  label: "Step 4: AI is working through each question — please wait...",              step: "step-generate" },
      { pct: 72,  label: "Step 5: Double-checking solutions with Verification engine (Max 2 retries)...", step: "step-verify" },
      { pct: 82,  label: "Step 5: Verification engine reviewing answers against the document...",     step: "step-verify"   },
    ];
    let nextThresholdIdx = 0;

    updateProgress(stepThresholds[0].label, 20);
    highlightStep(stepThresholds[0].step);
    nextThresholdIdx = 1;

    const startTime = performance.now();

    function animateProgress() {
      if (!progressRunning) return;

      // Ease toward 88% over ~120 seconds using a decelerating curve
      const elapsed = (performance.now() - startTime) / 1000;  // seconds
      // Asymptotic curve: starts fast, slows down, never exceeds 88
      simulatedPercent = 20 + (68 * (1 - Math.exp(-elapsed / 30)));

      // Cap at 88% so it never looks "done" before the API responds
      simulatedPercent = Math.min(simulatedPercent, 88);

      // Update step labels at thresholds
      while (
        nextThresholdIdx < stepThresholds.length &&
        simulatedPercent >= stepThresholds[nextThresholdIdx].pct
      ) {
        const th = stepThresholds[nextThresholdIdx];
        updateProgress(th.label, Math.round(simulatedPercent));
        highlightStep(th.step);
        nextThresholdIdx++;
      }

      // Smoothly update the bar
      progressBarFill.style.width = `${simulatedPercent.toFixed(1)}%`;
      progressPercent.textContent = `${Math.round(simulatedPercent)}%`;

      requestAnimationFrame(animateProgress);
    }

    requestAnimationFrame(animateProgress);

    // --- Actual API call ---
    const formData = new FormData();
    formData.append("file_id", uploadResponse.file_id);
    formData.append("file_name", uploadResponse.file_name);
    formData.append("safe_path", uploadResponse.safe_path);
    formData.append("api_key", apiKey);
    formData.append("model", model);
    formData.append("custom_instructions", instructions);

    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        body: formData,
      });

      // Stop the simulation loop
      progressRunning = false;

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to solve homework");
      }

      solvedResults = await res.json();

      updateProgress("Step 6: Inserting verified answers, tables & diagrams into documents...", 90);
      highlightStep("step-insert");

      setTimeout(() => {
        updateProgress("Step 7: Finished! Ready to download .DOCX and .PDF", 100);
        highlightStep("step-export");
        renderSolvedResults(solvedResults);
        
        btnStartSolve.disabled = false;
        solveBtnIcon.textContent = "🚀";
        solveBtnText.textContent = "Solve Again / Update";
      }, 800);

    } catch (err) {
      progressRunning = false;
      console.error(err);
      alert(`Error solving homework: ${err.message}`);
      
      btnStartSolve.disabled = false;
      solveBtnIcon.textContent = "🚀";
      solveBtnText.textContent = "Destroy My Homework (Solve & Verify)";
      progressPanel.classList.remove("active");
    }
  }

  function updateProgress(message, percent) {
    progressMessage.textContent = message;
    progressPercent.textContent = `${percent}%`;
    progressBarFill.style.width = `${percent}%`;
  }

  function renderSolvedResults(data) {
    questionCardsList.innerHTML = "";
    resultsSection.classList.add("active");

    btnDownloadDocx.href = data.downloads.docx;
    btnDownloadPdf.href = data.downloads.pdf;

    const items = data.items || [];
    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "q-card";

      const qLabel = item.question_number || `Question #${item.id}`;
      const verifiedBadge = item.verified
        ? `<span class="status-badge success">✓ Verified Pass (Retries: ${item.verification_rounds}/2)</span>`
        : `<span class="status-badge warning">Checked (Confidence: ${item.confidence}%)</span>`;

      // Render table if available
      let tableHtml = "";
      if (item.table_data && Array.isArray(item.table_data) && item.table_data.length > 0) {
        const headers = Object.keys(item.table_data[0]);
        let thRows = headers.map(h => `<th style="border: 1px solid rgba(255,255,255,0.1); padding: 6px 10px; background: rgba(6,182,212,0.15); color: var(--accent-cyan);">${escapeHtml(h)}</th>`).join("");
        let tdRows = item.table_data.map(row => {
          let cols = headers.map(h => `<td style="border: 1px solid rgba(255,255,255,0.08); padding: 6px 10px; text-align: center;">${escapeHtml(row[h] || "")}</td>`).join("");
          return `<tr>${cols}</tr>`;
        }).join("");
        tableHtml = `
          <div style="margin: 8px 0; overflow-x: auto;">
            <div style="font-size: 0.78rem; font-weight: 700; color: var(--accent-cyan); margin-bottom: 4px;">📊 ตารางผลลัพธ์ (Table Data):</div>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; background: rgba(0,0,0,0.2); border-radius: 6px;">
              <thead><tr>${thRows}</tr></thead>
              <tbody>${tdRows}</tbody>
            </table>
          </div>
        `;
      }

      // Render diagram if available
      let diagramHtml = "";
      if (item.diagram_ascii) {
        diagramHtml = `
          <div style="margin: 8px 0;">
            <div style="font-size: 0.78rem; font-weight: 700; color: var(--accent-cyan); margin-bottom: 4px;">🗺️ แผนผัง/โครงสร้างที่สรุป (Diagram / Visual Flow):</div>
            <pre style="background: rgba(0,0,0,0.35); padding: 10px 14px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 0.8rem; color: #a5f3fc; border: 1px solid rgba(6,182,212,0.2); overflow-x: auto; white-space: pre;">${escapeHtml(item.diagram_ascii)}</pre>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="q-card-header">
          <span class="q-number">${escapeHtml(qLabel)}</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span class="status-badge" style="background: rgba(6, 182, 212, 0.1); color: var(--accent-cyan);">${escapeHtml(item.context || "General")}</span>
            ${verifiedBadge}
          </div>
        </div>

        <div class="q-raw-text">
          <b>โจทย์/คำถาม:</b> ${escapeHtml(item.raw_question || "")}
        </div>

        <div class="q-answer-box">
          <span class="q-answer-label">คำตอบ:</span>
          <span class="q-answer-value">${escapeHtml(item.answer || "")}</span>
        </div>

        ${item.full_completed_sentence ? `
          <div class="q-completed-sentence">
            <b>ประโยคที่สมบูรณ์:</b> ${escapeHtml(item.full_completed_sentence)}
          </div>
        ` : ''}

        ${tableHtml}
        ${diagramHtml}

        <div class="q-explanation">
          <b>คำอธิบาย / วิธีคิด:</b> ${escapeHtml(item.explanation || "Direct solution.")}
        </div>

        <div class="q-card-footer">
          <span>Placeholder: <code>${escapeHtml(item.blank_token || "None")}</code></span>
          <span>${item.verification_critique ? escapeHtml(item.verification_critique) : "Accurate"}</span>
        </div>
      `;

      questionCardsList.appendChild(card);
    });

    // Scroll smoothly to results
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // --------------------------------------------------------------------------
  // Copy Answers
  // --------------------------------------------------------------------------
  function copyAllAnswers() {
    if (!solvedResults || !solvedResults.items) return;
    
    let text = `Homework Destroyer - Solved Answers\nSource: ${solvedResults.file_name}\n\n`;
    solvedResults.items.forEach((item) => {
      text += `[#${item.id}] ${item.raw_question}\n`;
      text += `-> Answer: ${item.answer}\n`;
      text += `-> Explanation: ${item.explanation}\n\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      const originalText = btnCopyAnswers.innerHTML;
      btnCopyAnswers.innerHTML = "<span>✓</span> Copied!";
      setTimeout(() => {
        btnCopyAnswers.innerHTML = originalText;
      }, 2000);
    });
  }

  // --------------------------------------------------------------------------
  // Window Minimize & Compact Mode
  // --------------------------------------------------------------------------
  function toggleMinimize() {
    // 1. If running under native PyWebView, call native window minimize
    if (window.pywebview && window.pywebview.api && window.pywebview.api.minimize) {
      window.pywebview.api.minimize();
      return;
    }

    // 2. Otherwise toggle browser compact floating mode
    const isMinimized = appMainContainer.style.display === "none";
    if (isMinimized) {
      restoreWebapp();
    } else {
      minimizeWebapp();
    }
  }

  function minimizeWebapp() {
    appMainContainer.style.display = "none";
    windowTitlebar.style.display = "none";
    miniDockWidget.classList.add("active");
  }

  function restoreWebapp() {
    appMainContainer.style.display = "flex";
    windowTitlebar.style.display = "flex";
    miniDockWidget.classList.remove("active");
  }

  function toggleFullscreen() {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.toggle_fullscreen) {
      window.pywebview.api.toggle_fullscreen();
      return;
    }

    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  // --------------------------------------------------------------------------
  // Event Listeners
  // --------------------------------------------------------------------------
  function setupEventListeners() {
    btnStartSolve.addEventListener("click", startSolvingPipeline);
    btnCopyAnswers.addEventListener("click", copyAllAnswers);

    btnMinimize.addEventListener("click", toggleMinimize);
    btnCompactMode.addEventListener("click", toggleMinimize);
    miniDockWidget.addEventListener("click", restoreWebapp);
    btnFullscreen.addEventListener("click", toggleFullscreen);

    btnResetApp.addEventListener("click", () => {
      if (confirm("Reset current document and answers?")) {
        resetFileSelection();
      }
    });

    btnToggleKeyVisibility.addEventListener("click", () => {
      if (apiKeyInput.type === "password") {
        apiKeyInput.type = "text";
        btnToggleKeyVisibility.textContent = "🔒";
      } else {
        apiKeyInput.type = "password";
        btnToggleKeyVisibility.textContent = "👁️";
      }
    });

    btnTestKey.addEventListener("click", async () => {
      const key = apiKeyInput.value.trim();
      const model = modelSelect.value;
      if (!key) {
        alert("Please enter a Gemini API Key to test.");
        return;
      }

      setKeyStatus("Testing...", "warning");
      try {
        const res = await fetch("/api/check-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: key, model: model }),
        });
        const data = await res.json();
        if (data.success) {
          setKeyStatus("Connected & Valid!", "success");
          alert("Success! Connected to Gemini API.");
        } else {
          setKeyStatus("Invalid Key", "error");
          alert(`API Connection Failed: ${data.error}`);
        }
      } catch (err) {
        setKeyStatus("Connection Error", "error");
        alert(`Request failed: ${err.message}`);
      }
    });

    btnSaveKey.addEventListener("click", async () => {
      const key = apiKeyInput.value.trim();
      if (!key) {
        alert("Please enter a key before saving.");
        return;
      }

      localStorage.setItem("gemini_api_key", key);

      try {
        const res = await fetch("/api/save-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: key }),
        });
        const data = await res.json();
        if (data.success) {
          setKeyStatus("Saved (.env)", "success");
          alert("API Key saved to .env and browser storage!");
        } else {
          setKeyStatus("Saved Locally", "warning");
        }
      } catch (e) {
        setKeyStatus("Saved Locally", "warning");
      }
    });
  }

});
