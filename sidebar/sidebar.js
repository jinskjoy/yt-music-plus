import { StorageManager } from '../utils/storage.js';
import { MessageManager } from '../utils/messages.js';
import { DOMHelper } from '../utils/dom-helper.js';

/**
 * SidebarController - Manages the sidebar panel interface
 * Handles playlist display, filtering, and statistics rendering
 */
class SidebarController {
  constructor() {
    this.storageManager = new StorageManager();
    this.messageManager = new MessageManager();
    this.domHelper = DOMHelper;
    this.playlists = [];
    this.filteredPlaylists = [];

    this.initializeEventListeners();
    this.loadData();
  }

  /**
   * Initializes sidebar event listeners
   */
  initializeEventListeners() {
    this.attachListener('closeSidebarBtn', () => this.closeSidebar());
    this.attachListener('searchInput', (e) => this.filterPlaylists(e.target.value), 'input');
    this.attachListener('refreshAllBtn', () => this.refreshAllPlaylists());
  }

  /**
   * Helper to attach event listeners to elements by ID
   * @param {string} elementId - Element ID
   * @param {Function} handler - Event handler
   * @param {string} eventType - Event type (default: click)
   */
  attachListener(elementId, handler, eventType = 'click') {
    const element = document.getElementById(elementId);
    if (element) {
      element.addEventListener(eventType, handler);
    }
  }

  /**
   * Loads playlist and stats data from storage and background script
   * @async
   */
  async loadData() {
    try {
      // Load cached data from storage
      const data = await this.storageManager.get(['playlists', 'stats']);
      if (data.playlists) {
        this.playlists = data.playlists;
        this.filteredPlaylists = [...this.playlists];
      }

      // Request fresh data from background script
      const response = await this.messageManager.sendToBackground({
        action: 'getPlaylistData',
      });

      if (response?.success) {
        this.playlists = response.playlists || [];
        this.filteredPlaylists = [...this.playlists];
      }

      this.renderPlaylists();
      this.renderStats(data.stats || {});
    } catch (error) {
      // Gracefully handle errors and display empty state
      this.showEmptyState();
    }
  }

  /**
   * Renders playlist items to the UI
   */
  renderPlaylists() {
    const listContainer = document.getElementById('playlistList');
    listContainer.innerHTML = '';

    if (this.filteredPlaylists.length === 0) {
      this.showEmptyState();
      return;
    }

    // Render each playlist item
    this.filteredPlaylists.forEach((playlist) => {
      const item = this.domHelper.createElement('div', 'playlist-item', {
        innerHTML: `
          <div class="playlist-item-name">${this.escapeHtml(playlist.name)}</div>
          <div class="playlist-item-count">${playlist.count || 0} songs</div>
        `,
      });

      item.addEventListener('click', () => this.handlePlaylistClick(playlist));
      listContainer.appendChild(item);
    });
  }

  /**
   * Filters playlists based on search query
   * @param {string} query - Search query string
   */
  filterPlaylists(query) {
    const searchTerm = query.toLowerCase().trim();
    this.filteredPlaylists = this.playlists.filter((playlist) =>
      playlist.name.toLowerCase().includes(searchTerm)
    );
    this.renderPlaylists();
  }

  /**
   * Handles playlist item click events
   * @param {Object} playlist - Playlist object
   */
  handlePlaylistClick(playlist) {
    this.messageManager.sendToContent({
      action: 'highlightPlaylist',
      playlistId: playlist.id,
    }).catch(() => {
      // Silently handle errors when sending to content script
    });
  }

  /**
   * Refreshes all playlists from the background script
   * @async
   */
  async refreshAllPlaylists() {
    try {
      const response = await this.messageManager.sendToBackground({
        action: 'refreshAllPlaylists',
      });

      if (response?.success) {
        // Reload data after successful refresh
        await this.loadData();
      }
    } catch (error) {
      // Silently handle refresh errors
    }
  }

  /**
   * Renders statistics section with playlist and song counts
   * @param {Object} stats - Statistics object
   */
  renderStats(stats) {
    const statsContainer = document.getElementById('statsContainer');
    if (!statsContainer) return;

    statsContainer.innerHTML = `
      <div class="stat-item">
        <div class="stat-label">Total Playlists</div>
        <div class="stat-value">${stats.totalPlaylists || 0}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Total Songs</div>
        <div class="stat-value">${stats.totalSongs || 0}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Last Updated</div>
        <div class="stat-value">${stats.lastUpdated ? this.formatDate(stats.lastUpdated) : 'N/A'}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Auto Refresh</div>
        <div class="stat-value">${stats.autoRefreshEnabled ? '✓' : '✕'}</div>
      </div>
    `;
  }

  /**
   * Formats a timestamp into a readable date string
   * @param {number} timestamp - Timestamp in milliseconds
   * @returns {string} Formatted date string
   */
  formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Escapes HTML special characters to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Displays empty state message when no playlists are found
   */
  showEmptyState() {
    const listContainer = document.getElementById('playlistList');
    if (listContainer) {
      listContainer.innerHTML = '<div class="empty-state">No playlists found</div>';
    }
  }

  /**
   * Closes the sidebar panel
   */
  closeSidebar() {
    this.messageManager.sendToBackground({
      action: 'closeSidebar',
    }).catch(() => {
      // Silently handle close errors
    });
  }
}

// Initialize sidebar when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SidebarController();
});
