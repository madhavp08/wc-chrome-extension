let overlayEl = null;
let busy = false;
let gamePickerOpen = false;

const voteQueue = [];
const pendingBreakdowns = [];
const handled = new Set();
const voted = new Set();

const CARD_BG = "#121212";
const YES_COLOR = "#00b86b";
const NO_COLOR = "#e5342b";
const YES_KEYS = new Set(["a", "j"]);
const NO_KEYS = new Set(["d", "l"]);
const RESULTS_SHOW_MS = 6000;

setInterval(syncTick, POLL.syncSeconds * 1000);

function syncTick() {
  if (document.hidden || overlayEl || busy || gamePickerOpen) return;
  if (!chrome.runtime || !chrome.runtime.id) return;
  try {
    chrome.storage.local.get("enabled", ({ enabled }) => {
      if (!enabled) {
        gamePickerOpen = false;
        return;
      }
      chrome.runtime.sendMessage({ type: "sync" }, (res) => {
        if (chrome.runtime.lastError) return;
        if (res && res.needGamePick && res.games && res.games.length) {
          showGamePicker(res.games);
          return;
        }
        ingestActivePolls(res && res.activePolls ? res.activePolls : []);
        tryStartVote();
        tryStartBreakdown();
      });
    });
  } catch (e) {}
}

function ingestActivePolls(polls) {
  const now = Date.now();
  for (const poll of polls) {
    if (handled.has(poll.question)) continue;
    const opened = Date.parse(poll.openedAt);
    if (Number.isNaN(opened)) continue;
    const voteEnd = opened + POLL.decisionSeconds * 1000;
    if (now >= voteEnd && !voted.has(poll.question)) {
      scheduleBreakdown(poll.question, opened);
      continue;
    }
    if (now >= voteEnd) continue;
    if (voteQueue.some((p) => p.question === poll.question)) continue;
    if (voted.has(poll.question)) {
      scheduleBreakdown(poll.question, opened);
      continue;
    }
    voteQueue.push({ question: poll.question, openedAt: poll.openedAt, opened });
  }
}

function scheduleBreakdown(question, opened) {
  if (handled.has(question)) return;
  const showAt = opened + POLL.resultsDelaySeconds * 1000;
  if (pendingBreakdowns.some((b) => b.question === question)) return;
  if (voted.has(question)) {
    pendingBreakdowns.push({ question, showAt });
    pendingBreakdowns.sort((a, b) => a.showAt - b.showAt);
  } else if (Date.now() >= showAt) {
    handled.add(question);
  }
}

function tryStartVote() {
  if (busy || overlayEl || gamePickerOpen || !voteQueue.length) return;
  const poll = voteQueue.shift();
  const voteEnd = poll.opened + POLL.decisionSeconds * 1000;
  if (Date.now() >= voteEnd) {
    handled.add(poll.question);
    return;
  }
  busy = true;
  showPoll(poll, voteEnd);
}

function tryStartBreakdown() {
  if (busy || overlayEl || gamePickerOpen || !pendingBreakdowns.length) return;
  const next = pendingBreakdowns[0];
  if (Date.now() < next.showAt) return;
  pendingBreakdowns.shift();
  busy = true;
  showBreakdown(next.question, () => {
    handled.add(next.question);
    busy = false;
    tryStartBreakdown();
    tryStartVote();
  });
}

function showGamePicker(games) {
  if (overlayEl || gamePickerOpen) return;
  gamePickerOpen = true;
  busy = true;

  const { el, content } = makeCard();
  overlayEl = el;

  div(content, "Which match should VARdict follow?", {
    fontSize: "17px",
    fontWeight: "700",
    lineHeight: "1.3",
    marginBottom: "8px"
  });
  div(content, "You can change this only by turning VARdict off.", {
    fontSize: "12px",
    color: "#888888",
    marginBottom: "16px"
  });

  games.forEach((game) => {
    const btn = document.createElement("button");
    btn.textContent = game.label;
    Object.assign(btn.style, {
      display: "block",
      width: "100%",
      marginBottom: "8px",
      padding: "12px",
      fontSize: "14px",
      fontWeight: "600",
      background: "transparent",
      color: "#ffffff",
      border: "1px solid rgba(255,255,255,0.3)",
      borderRadius: "8px",
      cursor: "pointer",
      textAlign: "left"
    });
    btn.addEventListener("click", () => {
      btn.disabled = true;
      chrome.runtime.sendMessage(
        { type: "selectGame", gameId: game.id, label: game.label },
        () => {
          gamePickerOpen = false;
          busy = false;
          clearOverlay();
        }
      );
    });
    content.appendChild(btn);
  });

  document.body.appendChild(el);
}

function showPoll(poll, voteEnd) {
  let selected = null;
  let finalized = false;
  let confirmTimer = null;

  const { el, content } = makeCard();
  overlayEl = el;
  const msLeft = Math.max(1000, voteEnd - Date.now());

  div(content, poll.question, {
    fontSize: "18px",
    fontWeight: "700",
    lineHeight: "1.3",
    marginBottom: "16px"
  });

  const row = div(content, "", { display: "flex", gap: "10px" });
  const buttons = POLL.options.map((label) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    Object.assign(btn.style, {
      flex: "1",
      padding: "12px 0",
      fontSize: "16px",
      fontWeight: "600",
      background: "transparent",
      color: "#ffffff",
      border: "1px solid rgba(255,255,255,0.3)",
      borderRadius: "8px",
      cursor: "pointer"
    });
    btn.addEventListener("click", () => pick(label, btn));
    row.appendChild(btn);
    return btn;
  });

  function pick(label, btn) {
    selected = label;
    buttons.forEach((b) => {
      const on = b === btn;
      b.style.background = on ? "#ffffff" : "transparent";
      b.style.color = on ? "#111111" : "#ffffff";
    });
    note.textContent = `Submitting in ${POLL.confirmSeconds}s unless you change it.`;
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(finalize, POLL.confirmSeconds * 1000);
  }

  function onKey(e) {
    if (finalized) return;
    const k = e.key.toLowerCase();
    if (YES_KEYS.has(k)) {
      e.preventDefault();
      e.stopPropagation();
      pick("Yes", buttons[0]);
    } else if (NO_KEYS.has(k)) {
      e.preventDefault();
      e.stopPropagation();
      pick("No", buttons[1]);
    }
  }

  document.addEventListener("keydown", onKey, true);

  const note = div(content, `You have ${Math.ceil(msLeft / 1000)} seconds to decide.`, {
    marginTop: "16px",
    fontSize: "12px",
    color: "#888888"
  });
  const status = div(content, "", {
    marginTop: "8px",
    fontSize: "13px",
    fontWeight: "600",
    minHeight: "16px"
  });

  document.body.appendChild(el);
  const maxTimer = setTimeout(finalize, msLeft);

  function finalize() {
    if (finalized) return;
    finalized = true;
    document.removeEventListener("keydown", onKey, true);
    clearTimeout(confirmTimer);
    clearTimeout(maxTimer);
    buttons.forEach((b) => (b.disabled = true));

    if (selected === null) {
      clearOverlay();
      handled.add(poll.question);
      busy = false;
      tryStartVote();
      return;
    }

    status.textContent = "Saving…";
    chrome.runtime.sendMessage(
      { type: "vote", choice: selected, question: poll.question },
      (res) => {
        voted.add(poll.question);
        status.textContent =
          !chrome.runtime.lastError && res && res.ok
            ? `Recorded: ${selected}`
            : "Could not save your vote.";
        scheduleBreakdown(poll.question, poll.opened);
        setTimeout(() => {
          clearOverlay();
          busy = false;
          tryStartBreakdown();
          tryStartVote();
        }, 800);
      }
    );
  }
}

function showBreakdown(question, done) {
  const { el, content } = makeCard();
  overlayEl = el;

  div(content, question, {
    fontSize: "15px",
    fontWeight: "700",
    lineHeight: "1.3",
    marginBottom: "14px"
  });
  const body = div(content, "Loading results…", { fontSize: "12px", color: "#888888" });
  document.body.appendChild(el);

  chrome.runtime.sendMessage({ type: "breakdown", question }, (res) => {
    if (chrome.runtime.lastError || !res || !res.ok || res.total <= POLL.resultsThreshold) {
      clearOverlay();
      done();
      return;
    }
    renderBar(body, res.yes, res.no, res.total);
    setTimeout(() => {
      clearOverlay();
      done();
    }, RESULTS_SHOW_MS);
  });
}

function makeCard() {
  const el = document.createElement("div");
  Object.assign(el.style, {
    position: "fixed",
    top: "18px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "2147483647",
    width: "340px",
    background: CARD_BG,
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.08)",
    overflow: "hidden",
    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
    fontFamily: "-apple-system, system-ui, sans-serif",
    color: "#ffffff"
  });
  const content = document.createElement("div");
  Object.assign(content.style, {
    padding: "20px",
    minHeight: "150px",
    boxSizing: "border-box"
  });
  el.appendChild(content);
  return { el, content };
}

function div(parent, text, styles) {
  const d = document.createElement("div");
  if (text) d.textContent = text;
  Object.assign(d.style, styles || {});
  parent.appendChild(d);
  return d;
}

function clearOverlay() {
  if (overlayEl && overlayEl.parentNode) {
    overlayEl.parentNode.removeChild(overlayEl);
  }
  overlayEl = null;
}

function renderBar(body, yes, no, total) {
  const yesPct = Math.round((yes / total) * 100);
  const noPct = 100 - yesPct;

  body.textContent = "";
  body.style.color = "#ffffff";

  const labels = div(body, "", {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "13px",
    fontWeight: "700",
    marginBottom: "8px"
  });
  const y = document.createElement("span");
  y.textContent = `Yes ${yesPct}%`;
  y.style.color = YES_COLOR;
  const n = document.createElement("span");
  n.textContent = `No ${noPct}%`;
  n.style.color = NO_COLOR;
  labels.appendChild(y);
  labels.appendChild(n);

  const bar = div(body, "", {
    display: "flex",
    height: "14px",
    borderRadius: "7px",
    overflow: "hidden",
    background: "#222222"
  });
  div(bar, "", { width: `${yesPct}%`, background: YES_COLOR });
  div(bar, "", { width: `${noPct}%`, background: NO_COLOR });
}
