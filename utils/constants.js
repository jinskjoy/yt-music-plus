/**
 * Constants used across the YouTube Music Plus extension
 */

export const CONSTANTS = {
  PLAYER: {
    MAX_RETRIES: 10,
    RETRY_INTERVAL_MS: 1000,
    SEEK_DURATION_SECONDS: 10,
  },
  UI: {
    STATUS_DURATION_MS: 3000,
    DEBOUNCE_DELAY_MS: 300,
    THROTTLE_LIMIT_MS: 300,
    ISSUE_URL: 'https://chromewebstore.google.com/detail/lkieghnbgfnidfhdeclkjkmnjokmkmdc/support',
  },
  SETTINGS: {
    DEFAULT: {
      showNavButton: true,
      showPlaylistButton: true,
      loadAllPlaylists: false,
      hideWarningMessage: false
    }
  },
  API: {
    INNERTUBE_ENDPOINT: 'https://music.youtube.com',
    PLAYLIST_BROWSE_IDS: [
      'FEmusic_liked_playlists',
      'FEmusic_library_landing'
    ],
    SIMILARITY_THRESHOLD: 0.5,
    JARO_WINKLER_PREFIX_LEN: 4,
    JARO_WINKLER_SCALING_FACTOR: 0.1,
    TIMEOUT_DURATION_MS: 100,
    PAGE_LOAD_TIMEOUT_MS: 3000,
    BASE_URL: 'https://music.youtube.com/watch?v=',
    PLAYLIST_PAGE_PATH: 'https://music.youtube.com/playlist',
  },
  PARSER: {
    FILTER_TEXTS: [', ', ' & ', ' - ', 'Song', 'Video', ' • '],
    EDIT_KEYWORDS: ['edit details', 'delete playlist', 'rename playlist', 'edit playlist'],
  },
  REGEX: {
    GENERIC_NAME: /^\d*\s*(?:-|_)?\s*(?:(?:unknown|untitled|misc)(?:\s*artist)?\s*(?:-|_)?\s*)?(?:track|audio\s*track|unknown|untitled|misc)\s*\d*$/i,
    VIDEO_SUFFIX: /(official\s*)?(music\s*)?video/gi,
  },
  MEDIA: {
    EXTENSIONS: ['.mp3', '.flac', '.m4a', '.ogg', '.wav', '.aac', '.wma', '.opus'],
  },
  STORAGE_KEYS: {
    // Add storage keys here if needed
  }
};
