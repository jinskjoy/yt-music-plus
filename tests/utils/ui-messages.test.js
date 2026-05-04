import { describe, it, expect } from 'vitest';
import { MESSAGES } from '../../utils/ui-messages.js';

describe('MESSAGES', () => {
  it('should have correct search messages', () => {
    expect(MESSAGES.SEARCH.FETCHING_ALL_TRACKS).toBe('Fetching all tracks...');
    expect(MESSAGES.SEARCH.FINDING_UNAVAILABLE).toBe('Finding unavailable tracks...');
    expect(MESSAGES.SEARCH.FINDING_VIDEO_TRACKS).toBe('Finding video tracks...');
    expect(MESSAGES.SEARCH.FINDING_DUPLICATES).toBe('Finding duplicate tracks...');
    expect(MESSAGES.SEARCH.FINDING_REPLACEMENTS).toBe('Finding replacements...');
    expect(MESSAGES.SEARCH.RECHECKING_TARGET).toBe('Rechecking duplicates in target playlist...');
    expect(MESSAGES.SEARCH.CANCELLING).toBe('Cancelling search... Please wait.');
  });

  it('should have correct result messages', () => {
    expect(MESSAGES.RESULTS.FOUND_TRACKS(10)).toBe('Found 10 tracks.');
    expect(MESSAGES.RESULTS.FOUND_DUPLICATE_GROUPS(5, 12)).toBe('Found 5 duplicate groups (12 tracks total).');
    expect(MESSAGES.RESULTS.NO_TRACKS_FOUND).toBe('No tracks found in this playlist.');
    expect(MESSAGES.RESULTS.NO_UNAVAILABLE_FOUND).toBe('No unavailable tracks found.');
    expect(MESSAGES.RESULTS.NO_VIDEO_TRACKS_FOUND).toBe('No video tracks found.');
    expect(MESSAGES.RESULTS.NO_DUPLICATES_FOUND).toBe('No duplicate tracks found.');
    expect(MESSAGES.RESULTS.REPLACEMENTS_FOUND(3)).toBe('Found 3 potential replacements.');
    expect(MESSAGES.RESULTS.DUPLICATE_IN_TARGET(2)).toBe(' 2 of these are already in the target playlist and have been unchecked.');
    expect(MESSAGES.RESULTS.TARGET_DUPLICATES_FOUND(4)).toBe('Found 4 duplicates in the new target playlist.');
    expect(MESSAGES.RESULTS.NO_TARGET_DUPLICATES_FOUND).toBe('No duplicates found in the new target playlist.');
    expect(MESSAGES.RESULTS.NO_REPLACEMENTS_FOUND).toBe('No replacements found.');
    expect(MESSAGES.RESULTS.MATCH_QUALITY_WARNING('high')).toBe(' Match quality: high. Please review replacements.');
  });

  it('should have correct action messages', () => {
    expect(MESSAGES.ACTIONS.REPLACE_CONFIRM(1)).toBe('Are you sure you want to replace 1 selected item?');
    expect(MESSAGES.ACTIONS.REPLACE_CONFIRM(2)).toBe('Are you sure you want to replace 2 selected items?');
    expect(MESSAGES.ACTIONS.KEEP_SELECTED_CONFIRM(5, 3)).toBe('Keeping 5 items. Are you sure you want to remove 3 duplicate tracks?');
    expect(MESSAGES.ACTIONS.REMOVING_ITEMS(2, 5)).toBe('Removing track 2 of 5...');
    expect(MESSAGES.ACTIONS.REMOVING_SELECTED).toBe('Removing selected items...');
    expect(MESSAGES.ACTIONS.REMOVAL_COMPLETE(3)).toBe('All removals completed. Removed 3 items.');
    expect(MESSAGES.ACTIONS.KEEP_COMPLETE(4)).toBe('Duplicates cleaned up. Removed 4 tracks.');
    expect(MESSAGES.ACTIONS.NO_REMOVALS).toBe('No items were removed.');
    expect(MESSAGES.ACTIONS.REPLACE_ITEMS(1, 3)).toBe('Replacing track 1 of 3...');
    expect(MESSAGES.ACTIONS.REPLACING_SELECTED).toBe('Replacing selected items...');
    expect(MESSAGES.ACTIONS.REPLACE_COMPLETE(2)).toBe('All replacements completed. Replaced 2 items.');
    expect(MESSAGES.ACTIONS.NO_REPLACEMENTS_MADE).toBe('No valid replacements were made.');
    expect(MESSAGES.ACTIONS.ADD_ITEMS(1, 2, 'My Playlist')).toBe('Adding track 1 of 2 to My Playlist...');
    expect(MESSAGES.ACTIONS.ADDING_SELECTED).toBe('Adding selected items...');
    expect(MESSAGES.ACTIONS.ADD_COMPLETE(5, 'My Playlist')).toBe('All additions completed. Added 5 items to My Playlist.');
    expect(MESSAGES.ACTIONS.NO_ADDITIONS_MADE).toBe('No valid items were added.');
    expect(MESSAGES.ACTIONS.ERROR_OCCURRED('saving')).toBe('Error occurred while saving.');
  });

  it('should have correct import messages', () => {
    expect(MESSAGES.IMPORT.NO_FILES_SELECTED).toBe('No files selected for import.');
    expect(MESSAGES.IMPORT.READING_FILES(5)).toBe('Reading 5 audio files...');
  });
});
