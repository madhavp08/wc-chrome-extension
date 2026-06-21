let overlayEl = null;
let selected = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "showPoll") {
    showOverlay();
  }
});

function showOverlay() {
  if (overlayEl) return;
  selected = null;

  overlayEl = document.createElement("div");
  Object.assign(overlayEl.style, {
    position: "fixed",
    top: "16px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "2147483647",
    background: "#ffffff",
    color: "#111111",
    padding: "16px 18px",
    borderRadius: "10px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
    fontFamily: "-apple-system, system-ui, sans-serif",
    width: "280px",
    boxSizing: "border-box"
  });

  const question = document.createElement("div");
  question.textContent = POLL.question;
  Object.assign(question.style, {
    fontSize: "16px",
    fontWeight: "600",
    marginBottom: "12px"
  });
  overlayEl.appendChild(question);

  const row = document.createElement("div");
  Object.assign(row.style, { display: "flex", gap: "10px" });
  overlayEl.appendChild(row);

  const buttons = POLL.options.map((label) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    Object.assign(btn.style, {
      flex: "1",
      padding: "10px 0",
      fontSize: "15px",
      fontWeight: "600",
      background: "#ffffff",
      color: "#111111",
      border: "1px solid #d0d0d0",
      borderRadius: "8px",
      cursor: "pointer"
    });
    btn.addEventListener("click", () => {
      selected = label;
      buttons.forEach((b) => {
        const on = b === btn;
        b.style.background = on ? "#111111" : "#ffffff";
        b.style.color = on ? "#ffffff" : "#111111";
      });
    });
    row.appendChild(btn);
    return btn;
  });

  const note = document.createElement("div");
  note.textContent = `You have ${POLL.decisionSeconds} seconds to decide.`;
  Object.assign(note.style, {
    marginTop: "12px",
    fontSize: "12px",
    color: "#777777"
  });
  overlayEl.appendChild(note);

  const status = document.createElement("div");
  Object.assign(status.style, {
    marginTop: "6px",
    fontSize: "13px",
    fontWeight: "600",
    minHeight: "16px"
  });
  overlayEl.appendChild(status);

  document.body.appendChild(overlayEl);

  setTimeout(() => finalize(buttons, note, status), POLL.decisionSeconds * 1000);
}

function finalize(buttons, note, status) {
  buttons.forEach((b) => (b.disabled = true));

  if (selected === null) {
    note.textContent = "Time's up. No option selected.";
    removeSoon();
    return;
  }

  status.textContent = "Saving...";
  chrome.runtime.sendMessage({ type: "vote", choice: selected }, (res) => {
    if (chrome.runtime.lastError) {
      status.textContent = "Could not save your vote.";
    } else if (res && res.ok) {
      status.textContent = `Recorded: ${selected}`;
    } else {
      status.textContent = (res && res.error) || "Could not save your vote.";
    }
    removeSoon();
  });
}

function removeSoon() {
  setTimeout(() => {
    if (overlayEl && overlayEl.parentNode) {
      overlayEl.parentNode.removeChild(overlayEl);
    }
    overlayEl = null;
  }, 2500);
}
