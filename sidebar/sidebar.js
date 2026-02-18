import { StorageManager } from '../utils/storage.js';
import { MessageManager } from '../utils/messages.js';
import { DOMHelper } from '../utils/dom-helper.js';
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

  initializeEventListeners() {
    document.getElementById('closeSidebarBtn').addEventListener('click', () =>
      this.closeSidebar()
    );
    document.getElementById('searchInput').addEventListener('input', (e) =>
      this.filterPlaylists(e.target.value)
    );
    document.getElementById('refreshAllBtn').addEventListener('click', () =>
      this.refreshAllPlaylists()
    );
  }

  async loadData() {
    try {
      // Load playlists from storage
      const data = await this.storageManager.get(['playlists', 'stats']);
      if (data.playlists) {
        this.playlists = data.playlists;
        this.filteredPlaylists = [...this.playlists];
      }

      // Request fresh data from background script
      const response = await this.messageManager.sendToBackground({
        action: 'getPlaylistData',
      });

      if (response.success) {
        this.playlists = response.playlists || [];
        this.filteredPlaylists = [...this.playlists];
      }

      this.renderPlaylists();
      this.renderStats(data.stats || {});
    } catch (error) {
      console.error('Error loading data:', error);
      this.showEmptyState();
    }
  }

  renderPlaylists() {
    const listContainer = document.getElementById('playlistList');
    listContainer.innerHTML = '';

    if (this.filteredPlaylists.length === 0) {
      this.showEmptyState();
      return;
    }

    this.filteredPlaylists.forEach((playlist) => {
      const item = this.domHelper.createElement('div', 'playlist-item', {
        innerHTML: `
          <div class="playlist-item-name">${playlist.name}</div>
          <div class="playlist-item-count">${playlist.count} songs</div>
        `,
      });

      item.addEventListener('click', () =>
        this.handlePlaylistClick(playlist)
      );

      listContainer.appendChild(item);
    });
  }

  filterPlaylists(query) {
    const searchTerm = query.toLowerCase();
    this.filteredPlaylists = this.playlists.filter((playlist) =>
      playlist.name.toLowerCase().includes(searchTerm)
    );
    this.renderPlaylists();
  }

  handlePlaylistClick(playlist) {
    this.messageManager.sendToContent({
      action: 'highlightPlaylist',
      playlistId: playlist.id,
    });
  }

  async refreshAllPlaylists() {
    try {
      const response = await this.messageManager.sendToBackground({
        action: 'refreshAllPlaylists',
      });

      if (response.success) {
        // Reload data after refresh
        await this.loadData();
      }
    } catch (error) {
      console.error('Error refreshing playlists:', error);
    }
  }

  renderStats(stats) {
    const statsContainer = document.getElementById('statsContainer');
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

  formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  showEmptyState() {
    const listContainer = document.getElementById('playlistList');
    listContainer.innerHTML = '<div class="empty-state">No playlists found</div>';
  }

  closeSidebar() {
    this.messageManager.sendToBackground({
      action: 'closeSidebar',
    });
  }
}

// Initialize sidebar when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SidebarController();
});
