/**
 * Constants used across the YouTube Music Plus extension
 */

export const CONSTANTS = {
  PLAYER: {
    MAX_RETRIES: 10,
    RETRY_INTERVAL_MS: 1000,
    SEEK_DURATION_SECONDS: 10,
    SOURCE: {
      YOUTUBE: 'youtube',
      LOCAL: 'local'
    },
    STATE: {
      UNSTARTED: -1,
      ENDED: 0,
      PLAYING: 1,
      PAUSED: 2,
      BUFFERING: 3,
      CUED: 5
    }
  },
  UI: {
    STATUS_DURATION_MS: 3000,
    DEBOUNCE_DELAY_MS: 300,
    THROTTLE_LIMIT_MS: 300,
    UI_UPDATE_DELAY_MS: 500,
    ISSUE_URL: 'https://chromewebstore.google.com/detail/lkieghnbgfnidfhdeclkjkmnjokmkmdc/support',
    BUTTON_IDS: {
      FIND_UNAVAILABLE: 'findUnavailableBtn',
      FIND_VIDEO_TRACKS: 'findVideoTracksBtn',
      IMPORT_FROM_FOLDER: 'importFromFolderBtn',
      LIST_ALL_TRACKS: 'listAllTracksBtn',
      IMPORT_FROM_FILE: 'importFromFileBtn',
      CANCEL_SEARCH: 'cancelSearchBtn',
      REPLACE_SELECTED: 'replaceSelectedBtn',
      ADD_SELECTED: 'addSelectedBtn',
      REMOVE_SELECTED: 'removeSelectedBtn',
      FIND_REPLACE: 'findReplaceBtn',
      SYNC_PLAYLIST: 'syncPlaylistBtn',
      ADD_TO_PLAYLIST: 'addToPlaylistBtn',
      BACK_BUTTON: 'backButton',
      FIND_LOCAL_REPLACEMENTS: 'findLocalReplacementsBtn',
      IMPORT_FILE_INPUT: 'importFileInput',
      REFRESH_PLAYLISTS: 'refreshPlaylistsBtn',
      LOAD_ALL_PLAYLISTS: 'loadAllPlaylistsBtn',
      CLOSE_POPUP: 'closePopupBtn',
      MINIMIZE_POPUP: 'minimizePopupBtn',
      SELECT_TARGET_PLAYLIST: 'selectTargetPlaylistBtn',
      CANCEL_TARGET_SELECTION: 'cancelTargetSelectionBtn',
      REFRESH_TARGET_PLAYLISTS: 'refreshTargetPlaylistsBtn',
      LOAD_ALL_TARGET_PLAYLISTS: 'loadAllTargetPlaylistsBtn',
      CANCEL_TARGET_MODAL: 'cancelTargetModalBtn',
      CLOSE_TARGET_MODAL: 'closeTargetModalBtn',
    },
    ELEMENT_IDS: {
      PROGRESS_TEXT: 'progressText',
      SELECTION_FOOTER: 'ytMusicPlusSelectionFooter',
      ITEMS_GRID_CONTAINER: 'yt-music-plus-itemsGridContainer',
      SEARCH_INPUT: 'ytMusicPlusSearchInput',
      CLEAR_SEARCH_BTN: 'ytMusicPlusClearSearchBtn',
      SEARCH_PROGRESS: 'searchProgress',
      PLAYLISTS_LOADING_INDICATOR: 'playlistsLoadingIndicator',
      PLAYLISTS_GRID: 'playlistsGrid',
      POPUP_TITLE: 'popupTitle',
      NAV_BTN: 'yt-music-plus-nav-btn',
      ACTION_BUTTONS: 'yt-music-plus-action-buttons',
      POPUP_HOLDER: 'yt-music-plus-popup',
      PLAYLIST_DETAILS_SCREEN: 'playlistDetailsScreen',
      PLAYLIST_SELECTION_SCREEN: 'playlistSelectionScreen',
      MAIN_POPUP: 'yt-music-plus-mainPopup',
      TARGET_PLAYLIST_NAME: 'targetPlaylistName',
      TARGET_PLAYLIST_CONTAINER: 'targetPlaylistContainer',
      TARGET_PLAYLIST_MODAL: 'targetPlaylistModal',
      TARGET_PLAYLISTS_GRID: 'targetPlaylistsGrid',
      TARGET_PLAYLISTS_LOADING: 'targetPlaylistsLoadingIndicator',
    },
    CLASSES: {
      ACTIVE: 'active',
      HIDDEN: 'hidden',
      MINIMIZED: 'minimized',
      BTN_PRIMARY: 'btn-primary',
      BTN_SECONDARY: 'btn-secondary',
      BTN_DANGER: 'btn-danger',
      LIST_ONLY_MODE: 'list-only-mode',
      ITEM_CHECKBOX: 'item-checkbox',
      GRID_ROW: 'grid-row',
      BTN: 'btn',
      PLAYLIST_ACTION_BUTTONS: 'playlist-action-buttons',
      ITEMS_GRID_WRAPPER: 'items-grid-wrapper',
      POPUP_CONTAINER: 'yt-music-extended-popup-container',
      POPUP_HEADER: 'popup-header',
    },
    SELECTORS: {
      YT_MUSIC_HEADER: 'ytmusic-responsive-header-renderer',
      ITEMS_GRID_CHECKBOXES: '#yt-music-plus-itemsGridContainer .item-checkbox',
      ACTIVE_ACTION_BUTTON: '.playlist-action-buttons .btn.active',
    },
    STRINGS: {
      SELECT_TARGET_TITLE: 'Select Target Playlist',
      PLAYLIST_FALLBACK: 'playlist',
      IMPORT_ADD_PROGRESS_PREFIX: 'Adding track',
      IMPORT_ADD_COMPLETED: 'All additions completed.',
    }
  },
  SETTINGS: {
    DEFAULT: {
      showNavButton: true,
      showPlaylistButton: true,
      loadAllPlaylists: false,
      autoListAllTracks: true,
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
