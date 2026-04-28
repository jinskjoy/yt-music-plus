// Simple popup script to handle opening options
document.getElementById('yt-music-plus-openOptionsLink').addEventListener('click', function(e) {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
  window.close();
});
