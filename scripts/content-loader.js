(async () => {
  const src = chrome.runtime.getURL('scripts/content.js');
  await import(src);
  console.log('Content script loaded and executed');
})();