// Simple popup script to handle opening options
document.getElementById('openOptionsLink').addEventListener('click', function(e) {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
  window.close();
});
