/**
 * Content Loader Script
 * Entry point that dynamically imports and initializes the content script
 * This is necessary to support module syntax in content scripts
 */
(async () => {
  const src = chrome.runtime.getURL('scripts/content.js');
  await import(src);
})();