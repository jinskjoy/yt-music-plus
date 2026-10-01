import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentScriptController } from '../../scripts/content.js';

describe('ContentScriptController', () => {
  let controller;

  beforeEach(() => {
    document.body.innerHTML = '<div id="right-content"></div>';
  });

  it('should inject nav bar button with YTM+ text when showNavButton is true', () => {
    const navRight = document.getElementById('right-content');
    const dummyController = Object.create(ContentScriptController.prototype);
    dummyController.extSettings = { showNavButton: true };
    dummyController.injectNavBarButton();

    const btn = document.getElementById('yt-music-plus-nav-btn');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe('YTM+');
    expect(navRight.contains(btn)).toBe(true);
  });

  it('should not inject nav bar button if showNavButton is false', () => {
    const dummyController = Object.create(ContentScriptController.prototype);
    dummyController.extSettings = { showNavButton: false };
    dummyController.injectNavBarButton();

    const btn = document.getElementById('yt-music-plus-nav-btn');
    expect(btn).toBeNull();
  });
});
