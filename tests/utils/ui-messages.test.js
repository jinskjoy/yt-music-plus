import { describe, it, expect } from 'vitest';
import { MESSAGES } from '../../utils/ui-messages';

describe('ui-messages', () => {
  describe('SEARCH', () => {
    it('should have correct static messages', () => {
      expect(MESSAGES.SEARCH.FETCHING_ALL_TRACKS).toBe('Fetching all tracks...');
      expect(MESSAGES.SEARCH.FINDING_UNAVAILABLE).toBe('Finding unavailable tracks...');
      expect(MESSAGES.SEARCH.FINDING_VIDEO_TRACKS).toBe('Finding video tracks...');
      expect(MESSAGES.SEARCH.FINDING_DUPLICATES).toBe('Finding duplicate tracks...');
      expect(MESSAGES.SEARCH.FINDING_REPLACEMENTS).toBe('Finding replacements...');
      expect(MESSAGES.SEARCH.RECHECKING_TARGET).toBe('Rechecking duplicates in target playlist...');
      expect(MESSAGES.SEARCH.CANCELLING).toBe('Cancelling search... Please wait.');
    });
  });

  describe('RESULTS', () => {
    it('should have correct dynamic messages', () => {
      expect(MESSAGES.RESULTS.FOUND_TRACKS(5)).toBe('Found 5 tracks.');
      expect(MESSAGES.RESULTS.FOUND_DUPLICATE_GROUPS(3, 10)).toBe('Found 3 duplicate groups (10 tracks total).');
      expect(MESSAGES.RESULTS.REPLACEMENTS_FOUND(42)).toBe('Found 42 potential replacements.');
      expect(MESSAGES.RESULTS.DUPLICATE_IN_TARGET(5)).toBe(' 5 of these are already in the target playlist and have been unchecked.');
      expect(MESSAGES.RESULTS.TARGET_DUPLICATES_FOUND(8)).toBe('Found 8 duplicates in the new target playlist.');
      expect(MESSAGES.RESULTS.MATCH_QUALITY_WARNING('high')).toBe(' Match quality: high. Please review replacements.');
    });

    it('should have correct static messages', () => {
      expect(MESSAGES.RESULTS.NO_TRACKS_FOUND).toBe('No tracks found in this playlist.');
      expect(MESSAGES.RESULTS.NO_UNAVAILABLE_FOUND).toBe('No unavailable tracks found.');
      expect(MESSAGES.RESULTS.NO_VIDEO_TRACKS_FOUND).toBe('No video tracks found.');
      expect(MESSAGES.RESULTS.NO_DUPLICATES_FOUND).toBe('No duplicate tracks found.');
      expect(MESSAGES.RESULTS.NO_TARGET_DUPLICATES_FOUND).toBe('No duplicates found in the new target playlist.');
      expect(MESSAGES.RESULTS.NO_REPLACEMENTS_FOUND).toBe('No replacements found.');
    });
  });

  describe('ACTIONS', () => {
    it('should have correct dynamic messages', () => {
      expect(MESSAGES.ACTIONS.REPLACE_CONFIRM(1)).toBe('Are you sure you want to replace 1 selected item?');
      expect(MESSAGES.ACTIONS.REPLACE_CONFIRM(5)).toBe('Are you sure you want to replace 5 selected items?');
      expect(MESSAGES.ACTIONS.KEEP_SELECTED_CONFIRM(2, 3)).toBe('Keeping 2 items. Are you sure you want to remove 3 duplicate tracks?');
      expect(MESSAGES.ACTIONS.REMOVING_ITEMS(1, 10)).toBe('Removing track 1 of 10...');
      expect(MESSAGES.ACTIONS.REMOVAL_COMPLETE(5)).toBe('All removals completed. Removed 5 items.');
      expect(MESSAGES.ACTIONS.KEEP_COMPLETE(3)).toBe('Duplicates cleaned up. Removed 3 tracks.');
      expect(MESSAGES.ACTIONS.REPLACE_ITEMS(2, 5)).toBe('Replacing track 2 of 5...');
      expect(MESSAGES.ACTIONS.REPLACE_COMPLETE(4)).toBe('All replacements completed. Replaced 4 items.');
      expect(MESSAGES.ACTIONS.ADD_ITEMS(1, 3, 'My Playlist')).toBe('Adding track 1 of 3 to My Playlist...');
      expect(MESSAGES.ACTIONS.ADD_COMPLETE(3, 'Target')).toBe('All additions completed. Added 3 items to Target.');
      expect(MESSAGES.ACTIONS.ERROR_OCCURRED('saving')).toBe('Error occurred while saving.');
    });

    it('should have correct static messages', () => {
      expect(MESSAGES.ACTIONS.REMOVING_SELECTED).toBe('Removing selected items...');
      expect(MESSAGES.ACTIONS.NO_REMOVALS).toBe('No items were removed.');
      expect(MESSAGES.ACTIONS.REPLACING_SELECTED).toBe('Replacing selected items...');
      expect(MESSAGES.ACTIONS.NO_REPLACEMENTS_MADE).toBe('No valid replacements were made.');
      expect(MESSAGES.ACTIONS.ADDING_SELECTED).toBe('Adding selected items...');
      expect(MESSAGES.ACTIONS.NO_ADDITIONS_MADE).toBe('No valid items were added.');
    });
  });

  describe('IMPORT', () => {
    it('should have correct messages', () => {
      expect(MESSAGES.IMPORT.NO_FILES_SELECTED).toBe('No files selected for import.');
      expect(MESSAGES.IMPORT.READING_FILES(10)).toBe('Reading 10 audio files...');
    });
  });
});
