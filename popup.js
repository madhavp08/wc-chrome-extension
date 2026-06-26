const checkbox = document.getElementById("enabled");
const stateEl = document.getElementById("state");

function render() {
  if (!checkbox.checked) {
    stateEl.textContent = "Off.";
    return;
  }
  chrome.storage.local.get("selectedGameLabel").then(({ selectedGameLabel }) => {
    stateEl.textContent = selectedGameLabel
      ? `On. Following ${selectedGameLabel}.`
      : "On. Pick a live match on your page.";
  });
}

chrome.storage.local.get("enabled").then(({ enabled }) => {
  checkbox.checked = Boolean(enabled);
  render();
});

checkbox.addEventListener("change", () => {
  if (checkbox.checked) {
    chrome.storage.local.set({ enabled: true });
  } else {
    chrome.storage.local.set({
      enabled: false,
      selectedGameId: null,
      selectedGameLabel: null,
      afEventsLen: null
    });
  }
  render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.selectedGameLabel || changes.enabled)) {
    render();
  }
});
