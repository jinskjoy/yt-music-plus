/**
 * User-facing messages used throughout the extension
 */
export const MESSAGES = {
  SEARCH: {
    FETCHING_ALL_TRACKS: 'Fetching all tracks...',
    FINDING_UNAVAILABLE: 'Finding unavailable tracks...',
    FINDING_VIDEO_TRACKS: 'Finding video tracks...',
    FINDING_REPLACEMENTS: 'Finding replacements...',
    CANCELLING: 'Cancelling search... Please wait.',
  },
  RESULTS: {
    FOUND_TRACKS: (count) => `Found ${count} tracks.`,
    NO_TRACKS_FOUND: 'No tracks found in this playlist.',
    NO_UNAVAILABLE_FOUND: 'No unavailable tracks found.',
    NO_VIDEO_TRACKS_FOUND: 'No video tracks found.',
    REPLACEMENTS_FOUND: (count) => `Found ${count} potential replacements.`,
    NO_REPLACEMENTS_FOUND: 'No replacements found.',
    MATCH_QUALITY_WARNING: (quality) => ` Match quality: ${quality}. Please review replacements.`,
  },
  ACTIONS: {
    REPLACE_CONFIRM: (count) => `Are you sure you want to replace ${count} selected item${count !== 1 ? 's' : ''}?`,
    REMOVING_ITEMS: (current, total) => `Removing track ${current} of ${total}...`,
    REMOVING_SELECTED: 'Removing selected items...',
    REMOVAL_COMPLETE: (count) => `All removals completed. Removed ${count} items.`,
    NO_REMOVALS: 'No items were removed.',
    REPLACE_ITEMS: (current, total) => `Replacing track ${current} of ${total}...`,
    REPLACING_SELECTED: 'Replacing selected items...',
    REPLACE_COMPLETE: (count) => `All replacements completed. Replaced ${count} items.`,
    NO_REPLACEMENTS_MADE: 'No valid replacements were made.',
    ADD_ITEMS: (current, total, target) => `Adding track ${current} of ${total} to ${target}...`,
    ADDING_SELECTED: 'Adding selected items...',
    ADD_COMPLETE: (count, target) => `All additions completed. Added ${count} items to ${target}.`,
    NO_ADDITIONS_MADE: 'No valid items were added.',
    ERROR_OCCURRED: (action) => `Error occurred while ${action}.`,
  },
  IMPORT: {
    NO_FILES_SELECTED: 'No files selected for import.',
    READING_FILES: (count) => `Reading ${count} audio files...`,
  },
};
