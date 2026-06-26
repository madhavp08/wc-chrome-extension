let overlayEl = null;
let queue = [];
let votedQuestions = [];
let busy = false;

const CARD_BG = "#121212";
const YES_COLOR = "#00b86b";
const NO_COLOR = "#e5342b";

const MAX_QUEUE = 3;
const RESULTS_WAIT_MS = 20000;
const RESULTS_POLL_MS = 5000;
const RESULTS_SHOW_MS = 6000;
const YES_KEYS = new Set(["a", "j"]);
const NO_KEYS = new Set(["d", "l"]);

setInterval(tick, APIFOOTBALL_CONFIG.pollSeconds * 1000);

function tick() {
  if (document.hidden || overlayEl || busy) return;
  if (!chrome.runtime || !chrome.runtime.id) return;
  try {
    chrome.runtime.sendMessage({ type: "checkEvents" }, (res) => {
      if (chrome.runtime.lastError) return;
      const polls = res && Array.isArray(res.polls) ? res.polls : [];
      if (!polls.length) return;
      queue = polls.slice(-MAX_QUEUE);
      votedQuestions = [];
      busy = true;
      processNext();
    });
  } catch (e) {}
}

function processNext() {
  if (queue.length) {
    showPoll(queue.shift());
  } else {
    showResults();
  }
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

function showPoll(poll) {
  let selected = null;
  let finalized = false;
  let confirmTimer = null;

  const { el, content } = makeCard();
  overlayEl = el;

  div(content, poll.question, {
    fontSize: "18px",
    fontWeight: "700",
    lineHeight: "1.3",
    marginBottom: poll.context ? "8px" : "16px"
  });
  if (poll.context) {
    div(content, poll.context, { fontSize: "12px", color: "#888888", marginBottom: "16px" });
  }

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

  const note = div(content, `You have ${POLL.decisionSeconds} seconds to decide.`, {
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
  const maxTimer = setTimeout(finalize, POLL.decisionSeconds * 1000);

  function finalize() {
    if (finalized) return;
    finalized = true;
    document.removeEventListener("keydown", onKey, true);
    clearTimeout(confirmTimer);
    clearTimeout(maxTimer);
    buttons.forEach((b) => (b.disabled = true));

    if (selected === null) {
      clearOverlay();
      processNext();
      return;
    }

    status.textContent = "Saving…";
    votedQuestions.push(poll.question);
    chrome.runtime.sendMessage(
      { type: "vote", choice: selected, question: poll.question },
      (res) => {
        status.textContent =
          !chrome.runtime.lastError && res && res.ok
            ? `Recorded: ${selected}`
            : "Could not save your vote.";
        setTimeout(() => {
          clearOverlay();
          processNext();
        }, 1200);
      }
    );
  }
}

function showResults() {
  const questions = votedQuestions.slice();
  votedQuestions = [];
  showResultFor(questions, 0);
}

function showResultFor(questions, i) {
  if (i >= questions.length) {
    busy = false;
    return;
  }
  waitAndShowBar(questions[i], () => showResultFor(questions, i + 1));
}

function waitAndShowBar(question, done) {
  const { el, content } = makeCard();
  overlayEl = el;

  div(content, question, {
    fontSize: "15px",
    fontWeight: "700",
    lineHeight: "1.3",
    marginBottom: "14px"
  });
  const body = div(content, "Tallying votes…", { fontSize: "12px", color: "#888888" });

  document.body.appendChild(el);

  const start = Date.now();

  const poll = () => {
    chrome.runtime.sendMessage({ type: "breakdown", question }, (res) => {
      if (chrome.runtime.lastError) {
        clearOverlay();
        done();
        return;
      }
      const ready = res && res.ok && res.total > POLL.resultsThreshold;
      if (ready) {
        renderBar(body, res.yes, res.no, res.total);
        setTimeout(() => {
          clearOverlay();
          done();
        }, RESULTS_SHOW_MS);
        return;
      }
      if (Date.now() - start >= RESULTS_WAIT_MS) {
        clearOverlay();
        done();
        return;
      }
      setTimeout(poll, RESULTS_POLL_MS);
    });
  };

  poll();
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
