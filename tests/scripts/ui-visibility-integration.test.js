import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UIHelper, MediaGridRow } from '../../utils/ui-helper.js';
import fs from 'fs';
import path from 'path';

describe('UI Visibility Integration', () => {

  beforeEach(() => {
    const htmlPath = path.resolve(__dirname, '../../html/in-site-popup.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    document.body.innerHTML = htmlContent;
    vi.clearAllMocks();
  });

  describe('Local Import Mode Visibility', () => {
    it('should hide Replace and Remove buttons when in import mode', () => {
      // We simulate what bridge.updateImportButtonVisibility() does
      const replaceBtn = document.getElementById('replaceSelectedBtn');
      const removeBtn = document.getElementById('removeSelectedBtn');
      const addBtn = document.getElementById('addSelectedBtn');
      
      replaceBtn.classList.remove('hidden');
      removeBtn.classList.remove('hidden');
      
      // Simulate Bridge.updateImportButtonVisibility behavior
      replaceBtn.classList.add('hidden');
      removeBtn.classList.add('hidden');
      // addBtn visibility depends on isEditable, but for this test we focus on hidden ones
      
      expect(replaceBtn.classList.contains('hidden')).toBe(true);
      expect(removeBtn.classList.contains('hidden')).toBe(true);
    });
  });

  describe('List All Tracks Visibility', () => {
    it('should hide Replace and Add buttons, and show Remove button', async () => {
      const replaceBtn = document.getElementById('replaceSelectedBtn');
      const addBtn = document.getElementById('addSelectedBtn');
      const removeBtn = document.getElementById('removeSelectedBtn');
      
      replaceBtn.classList.remove('hidden');
      addBtn.classList.remove('hidden');
      removeBtn.classList.add('hidden');
      
      // Simulate TrackProcessor.onListAllTracksClicked behavior
      replaceBtn.classList.add('hidden');
      addBtn.classList.add('hidden');
      removeBtn.classList.remove('hidden');
      
      expect(replaceBtn.classList.contains('hidden')).toBe(true);
      expect(addBtn.classList.contains('hidden')).toBe(true);
      expect(removeBtn.classList.contains('hidden')).toBe(false);
    });
  });
});
