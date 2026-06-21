importScripts("config.js");

const ALARM_NAME = "ref-watch-poll";

chrome.runtime.onInstalled.addListener(syncAlarm);
chrome.runtime.onStartup.addListener(syncAlarm);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.enabled) {
    syncAlarm();
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    pollActiveTab();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "vote") {
    submitVote(msg.choice)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

async function syncAlarm() {
  const { enabled } = await chrome.storage.local.get("enabled");
  if (enabled) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  } else {
    chrome.alarms.clear(ALARM_NAME);
  }
}

async function pollActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || !tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "showPoll" });
  } catch (e) {}
}

async function submitVote(choice) {
  const { url, anonKey, table } = SUPABASE_CONFIG;

  const headers = {
    apikey: anonKey,
    "Content-Type": "application/json",
    Prefer: "return=minimal"
  };
  if (anonKey.startsWith("ey")) {
    headers.Authorization = `Bearer ${anonKey}`;
  }

  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ question: POLL.question, choice })
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Save failed (${res.status}): ${detail}`);
  }
}
