import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('In-Site Popup HTML Templates', () => {
  let htmlContent;

  beforeEach(() => {
    // Load the HTML file content
    const htmlPath = path.resolve(__dirname, '../../html/in-site-popup.html');
    htmlContent = fs.readFileSync(htmlPath, 'utf8');
    document.body.innerHTML = htmlContent;
  });

  it('should have the playlist card template with required structure', () => {
    const template = document.getElementById('yt-music-plus-playlist-card-template');
    expect(template).not.toBeNull();
    
    const content = template.content;
    expect(content.querySelector('.yt-music-plus-playlist-card')).not.toBeNull();
    expect(content.querySelector('.yt-music-plus-playlist-card-thumbnail')).not.toBeNull();
    expect(content.querySelector('.yt-music-plus-playlist-card-title')).not.toBeNull();
    expect(content.querySelector('.yt-music-plus-playlist-card-meta')).not.toBeNull();
  });

  it('should have the media item template with required structure', () => {
    const template = document.getElementById('yt-music-plus-media-item-template');
    expect(template).not.toBeNull();
    
    const content = template.content;
    expect(content.querySelector('.yt-music-plus-media-item')).not.toBeNull();
    expect(content.querySelector('.yt-music-plus-media-thumbnail')).not.toBeNull();
    expect(content.querySelector('.yt-music-plus-media-title')).not.toBeNull();
    expect(content.querySelector('.yt-music-plus-media-artist')).not.toBeNull();
    expect(content.querySelector('.yt-music-plus-media-link')).not.toBeNull();
  });

  it('should have the grid row template with required structure', () => {
    const template = document.getElementById('yt-music-plus-grid-row-template');
    expect(template).not.toBeNull();
    
    const content = template.content;
    expect(content.querySelector('.yt-music-plus-grid-row')).not.toBeNull();
    expect(content.querySelector('.yt-music-plus-grid-col-serial')).not.toBeNull();
    expect(content.querySelector('.yt-music-plus-grid-col-original')).not.toBeNull();
    expect(content.querySelector('.yt-music-plus-grid-col-replacement')).not.toBeNull();
    expect(content.querySelector('.yt-music-plus-grid-col-checkbox')).not.toBeNull();
    expect(content.querySelector('.yt-music-plus-item-checkbox')).not.toBeNull();
    expect(content.querySelector('.yt-music-plus-warning-container')).not.toBeNull();
    expect(content.querySelector('.yt-music-plus-warning-icon')).not.toBeNull();
    expect(content.querySelector('.yt-music-plus-warning-message-text')).not.toBeNull();
  });

  it('should have the action buttons template with required structure', () => {
    const template = document.getElementById('yt-music-plus-action-buttons-template');
    expect(template).not.toBeNull();
    
    const content = template.content;
    expect(content.querySelector('#yt-music-plus-action-buttons')).not.toBeNull();
    expect(content.querySelector('.yt-music-plus-content-wrapper')).not.toBeNull();
    expect(content.querySelector('.yt-music-plus-icon')).not.toBeNull();
  });

  it('should have the minimize button in the popup header', () => {
    const minimizeBtn = document.getElementById('yt-music-plus-minimizePopupBtn');
    expect(minimizeBtn).not.toBeNull();
    expect(minimizeBtn.getAttribute('aria-label')).toBe('Minimize popup');
  });
});
