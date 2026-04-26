# YouTube Music + Features List

This document provides a comprehensive list of features for the YouTube Music + extension. It serves as a reference for manual and automated testing to ensure existing functionalities are maintained during development.

---

## 1. User Interface Integration

### 1.1 In-page Navigation Button
- **Feature**: A "YouTube Music +" button injected into the top navigation bar (right side).
- **Behavior**: Clicking this button opens the Main Management Popup.
- **Configurability**: Can be toggled on/off in Settings.
- **Testable Case**: Verify button appears when enabled and clicking it opens the popup.

### 1.2 In-page Playlist Button
- **Feature**: A "YouTube Music +" action button injected into the header of any playlist page.
- **Behavior**: Clicking this button opens the Main Management Popup and automatically selects the current playlist.
- **Configurability**: Can be toggled on/off in Settings.
- **Testable Case**: Navigate to a playlist page; verify button appears and auto-selects the playlist in the popup.

### 1.3 Sidebar Panel
- **Feature**: A fixed sidebar panel accessible via the extension icon (browser-specific behavior) or internal triggers.
- **Components**:
    - **Playlist List**: Displays all editable playlists.
    - **Search Input**: Real-time filtering of the playlist list.
    - **Statistics**: Shows usage or playlist statistics.
    - **Refresh Button**: Manually trigger a refresh of playlist data.
- **Testable Case**: Open sidebar; verify playlists are listed and filterable.

### 1.4 Main Management Popup (In-site Dialog)
- **Feature**: A central dialog for performing all major operations.
- **Screens**:
    - **Playlist Selection Screen**: Grid of playlists with thumbnails and track counts.
    - **Playlist Details Screen**: Active workspace for a selected playlist.
- **Minimize Option**: A "−" button in the header to collapse the popup to the bottom-right corner. When minimized, clicking the extension title or the "⤢" (expansion) icon restores it. The playlist title is hidden in the minimized view for a cleaner look.
- **Testable Case**: Verify navigation between selection and details screens using the "Back" button; verify the popup minimizes and restores correctly.

### 1.5 Settings/Options Page
- **Feature**: A dedicated page for user preferences.
- **Options**:
    - Toggle Navigation Button.
    - Toggle Playlist Page Button.
    - **Always load all playlists**: When enabled, the extension fetches all playlists from the user's library by default instead of only editable ones.
    - Reset "Hide Warning Message" state.
    - Save/Reset to Defaults buttons.
- **Testable Case**: Change a setting, save, and verify the UI updates accordingly on music.youtube.com.

---

## 2. Core Functionalities

### 2.1 Playlist Discovery & Sync
- **Feature**: Automatically fetches playlists from the user's account.
- **Refresh Options**:
    - **Load Editable Playlists**: Re-fetches only the playlists that the user has permission to edit.
    - **Load All Playlists**: Fetches all playlists found in the user's library, including liked playlists and albums added as playlists.
- **Default Behavior**: Defaults to editable playlists unless "Always load all playlists" is enabled in settings.
- **Testable Case**: Click "Load Editable Playlists" and verify only owned/editable playlists appear; click "Load All Playlists" and verify a broader set of playlists is loaded.

### 2.2 Find Unavailable Tracks
- **Feature**: Scans the selected playlist for "greyed-out" (unavailable) tracks.
- **Search**: Automatically searches YouTube Music for replacements for identified tracks.
- **Testable Case**: Select a playlist with unavailable tracks; click "Find Unavailable Tracks"; verify identified tracks appear in the grid with replacements.

### 2.3 Find Video Tracks
- **Feature**: Scans the selected playlist for music video tracks.
- **Search**: Searches for official audio versions to replace video tracks.
- **Testable Case**: Click "Find Video Tracks"; verify tracks are identified and search results prioritize official audio.

### 2.4 Import from Folder
- **Feature**: Uses the File System Access API to scan a local directory for audio files.
- **Behavior**:
    - Parses file names to create a search list.
    - Filters out "generic" or short filenames (e.g., "track 01").
    - **Preview Playback**: Allows users to preview local audio files directly in the popup before searching.
    - Allows users to search for these tracks on YTM.
- **Testable Case**: Select a local folder; verify files are listed; hover over a track and click "Play" to preview; click "Start Search" to find them on YTM.

### 2.5 Import from File
- **Feature**: Reads a `.txt` file where each line is a song title.
- **Behavior**: Similar to folder import; displays tracks for subsequent YTM searching.
- **Testable Case**: Upload a text file; verify tracks are listed correctly in the grid.

### 2.6 List All Tracks
- **Feature**: Fetches every track in the selected playlist.
- **Use Case**: Intended for bulk deletion or general management.
- **Testable Case**: Click "List All Tracks"; verify all tracks are displayed in the grid.

---

## 3. Track Management & Bulk Operations

### 3.1 Items Grid View
- **Columns**: Serial number, Original Media (with link), Replacement Media (with link), and Selection Checkbox.
- **Metadata**: Shows Title, Artist, and Album for both original and replacement tracks.
- **Testable Case**: Verify links to tracks open in a new tab.

### 3.2 Search & Filtering
- **Feature**: A search bar within the grid to filter identified tracks by title, artist, or album.
- **Behavior**: Updates the "Select All" logic to only affect visible (filtered) items.
- **Testable Case**: Enter a search term; verify only matching rows are visible; use "Select All" and verify only visible items are checked.

### 3.3 Selection Logic
- **Features**:
    - Individual checkboxes.
    - "Select All" header checkbox.
    - Smart selection: Only visible and valid (search completed) items can be selected for "Replace" or "Add" actions.
- **Testable Case**: Check/uncheck individual and bulk boxes; verify action buttons enable/disable correctly.

### 3.4 Action Buttons
- **Replace Selected**: Removes the original track and adds the replacement.
- **Add Selected**: Adds the replacement track without removing the original.
- **Remove Selected**: Deletes the selected track from the playlist.
- **Confirmation**: Deletion/Replacement actions prompt for user confirmation.
- **Testable Case**: Perform a "Replace" action; verify the original is gone and the new one is present in the YTM playlist.

### 3.5 Search Progress & Cancellation
- **Feature**: Real-time status updates (e.g., "Processing track X of Y").
- **Cancellation**: A "Cancel Search" button to stop ongoing API operations.
- **Testable Case**: Start a large scan; click "Cancel"; verify processing stops immediately.

### 3.6 Integrated Track Playback
- **Feature**: Playback controls (Play, Pause, Skip forward/backward 10s) integrated into the media grid.
- **Behavior**: Controls appear as an overlay when hovering over the track details section (Original or Replacement media).
- **Control**: Allows users to preview tracks directly within the popup without navigating away from the current workspace.
- **Enhanced Player API**: Exposed methods for advanced player control including `getVideoData`, `getPlayerState`, `nextTrack`, `previousTrack`, `getVolume`, `setVolume`, `isMuted`, `mute`, `unMute`, `getCurrentTime`, and `getDuration`.
- **Testable Case**: Hover over a track title in the grid; verify playback controls appear and function as expected (controlling the page's background player).

---

## 4. Safety & Reliability Features

### 4.1 Reload Prevention
- **Feature**: Prevents the page from being reloaded or navigated away from while an operation is in progress.
- **Warning**: Displays a message advising users to click "Cancel" or "Stay" if YTM prompts for a reload.
- **Testable Case**: Attempt to refresh the page during a "Replace" operation; verify the browser's reload confirmation appears.

### 4.2 Auth Token Interception
- **Feature**: Automatically intercepts the `Authorization` header from YTM requests to perform API operations on behalf of the user.
- **Behavior**: Transparent to the user; happens on initialization.
- **Testable Case**: Verify extension functionality works without requiring manual login (as long as the user is logged into YTM).

### 4.3 Grid Expansion
- **Feature**: A "⤢" button to expand the grid view for better visibility of many tracks.
- **Testable Case**: Click expand; verify the grid container enlarges.
