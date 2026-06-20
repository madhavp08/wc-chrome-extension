let selected = null;

const questionEl = document.getElementById("question");
const optionsEl = document.getElementById("options");
const noteEl = document.getElementById("note");
const statusEl = document.getElementById("status");

questionEl.textContent = POLL.question;
noteEl.textContent = `You have ${POLL.decisionSeconds} seconds to decide.`;

const buttons = POLL.options.map((label) => {
  const btn = document.createElement("button");
  btn.className = "option";
  btn.textContent = label;
  btn.addEventListener("click", () => select(label, btn));
  optionsEl.appendChild(btn);
  return btn;
});

function select(label, btn) {
  selected = label;
  buttons.forEach((b) => b.classList.toggle("selected", b === btn));
}

setTimeout(finalize, POLL.decisionSeconds * 1000);

async function finalize() {
  buttons.forEach((b) => (b.disabled = true));

  if (selected === null) {
    statusEl.textContent = "Time's up. No option selected.";
    return;
  }

  statusEl.textContent = "Saving...";
  try {
    await submitVote(selected);
    statusEl.textContent = `Recorded: ${selected}`;
  } catch (err) {
    statusEl.textContent = "Could not save your vote.";
  }
}

async function submitVote(choice) {
  const { url, anonKey, table } = SUPABASE_CONFIG;
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({ question: POLL.question, choice })
  });
  if (!res.ok) {
    throw new Error(`Supabase responded ${res.status}`);
  }
}
