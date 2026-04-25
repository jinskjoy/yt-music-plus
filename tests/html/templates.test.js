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
    expect(content.querySelector('.playlist-card')).not.toBeNull();
    expect(content.querySelector('.playlist-card-thumbnail')).not.toBeNull();
    expect(content.querySelector('.playlist-card-title')).not.toBeNull();
    expect(content.querySelector('.playlist-card-meta')).not.toBeNull();
  });

  it('should have the media item template with required structure', () => {
    const template = document.getElementById('yt-music-plus-media-item-template');
    expect(template).not.toBeNull();
    
    const content = template.content;
    expect(content.querySelector('.media-item')).not.toBeNull();
    expect(content.querySelector('.media-thumbnail')).not.toBeNull();
    expect(content.querySelector('.media-title')).not.toBeNull();
    expect(content.querySelector('.media-artist')).not.toBeNull();
    expect(content.querySelector('.media-link')).not.toBeNull();
  });

  it('should have the grid row template with required structure', () => {
    const template = document.getElementById('yt-music-plus-grid-row-template');
    expect(template).not.toBeNull();
    
    const content = template.content;
    expect(content.querySelector('.grid-row')).not.toBeNull();
    expect(content.querySelector('.grid-col-serial')).not.toBeNull();
    expect(content.querySelector('.grid-col-original')).not.toBeNull();
    expect(content.querySelector('.grid-col-replacement')).not.toBeNull();
    expect(content.querySelector('.grid-col-checkbox')).not.toBeNull();
    expect(content.querySelector('.item-checkbox')).not.toBeNull();
    expect(content.querySelector('.warning-icon')).not.toBeNull();
  });

  it('should have the action buttons template with required structure', () => {
    const template = document.getElementById('yt-music-plus-action-buttons-template');
    expect(template).not.toBeNull();
    
    const content = template.content;
    expect(content.querySelector('#yt-music-plus-action-buttons')).not.toBeNull();
    expect(content.querySelector('.content-wrapper')).not.toBeNull();
    expect(content.querySelector('.icon')).not.toBeNull();
  });

  it('should have the minimize button in the popup header', () => {
    const minimizeBtn = document.getElementById('minimizePopupBtn');
    expect(minimizeBtn).not.toBeNull();
    expect(minimizeBtn.getAttribute('aria-label')).toBe('Minimize popup');
  });
});
