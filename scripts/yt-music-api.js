import { YTMusicParser } from './yt-music-parser.js';
import { CONSTANTS } from '../utils/constants.js';

/**
 * YTMusicAPI - Handles all YouTube Music API interactions
 * Provides methods for playlist management, search, and item manipulation
 */
export class YTMusicAPI {
  constructor() {
    this.baseURL = CONSTANTS.API.INNERTUBE_ENDPOINT;
    this.authToken = null;
  }

  /**
   * Checks if authentication token is set
   * @returns {boolean}
   */
  isAuthTokenSet() {
    return !!this.authToken;
  }

  /**
   * Makes a GET request to the YouTube Music API
   * @async
   */
  async makeGetRequest(endpoint, params = {}) {
    const url = new URL(this.baseURL + endpoint);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const headers = {};
    if (this.authToken) {
      headers.Authorization = this.authToken;
    }

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Makes a POST request to the YouTube Music API
   * @async
   */
  async makePostRequest(endpoint, body = {}) {
    const url = this.baseURL + endpoint;

    const headers = {
      'Content-Type': 'application/json',
      accept: '*/*'
    };

    if (this.authToken) {
      headers.Authorization = this.authToken;
    }

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Sets authentication token for API requests
   */
  setAuthToken(token) {
    this.authToken = token;
  }

  /**
   * Gets Innertube context from page configuration
   */
  getInnertubeContext() {
    return window.ytcfg?.data_?.INNERTUBE_CONTEXT || window.ytcfg?.INNERTUBE_CONTEXT || {};
  }

  async fetchBrowsePlaylists(browseId) {
    return this.makePostRequest('/youtubei/v1/browse?prettyPrint=false', {
      context: this.getInnertubeContext(),
      browseId: browseId
    });
  }

  /**
   * Fetches playlists for the current user
   * @async
   * @param {boolean} onlyEditable - Whether to only return editable playlists
   * @returns {Promise<Array<Playlist>>}
   */
  async getPlaylists(onlyEditable = false) {
    let lastError = null;
    const allPlaylists = new Map();

    for (const browseId of CONSTANTS.API.PLAYLIST_BROWSE_IDS) {
      try {
        const response = await this.fetchBrowsePlaylists(browseId);
        const playlists = YTMusicParser.parsePlaylistsFromResponse(response, onlyEditable);
        playlists.forEach(p => {
          if (!allPlaylists.has(p.id)) {
            allPlaylists.set(p.id, p);
          } else if (p.isEditable) {
            // Prefer editable version if duplicate ID found
            allPlaylists.set(p.id, p);
          }
        });
      } catch (error) {
        lastError = error;
      }
    }

    if (allPlaylists.size > 0) {
      return Array.from(allPlaylists.values());
    }

    if (lastError) throw lastError;
    return [];
  }

  /**
   * Fetches all editable playlists for the current user
   * @deprecated Use getPlaylists(true)
   * @async
   * @returns {Promise<Array<Playlist>>}
   */
  async getEditablePlaylists() {
    return this.getPlaylists(true);
  }

  /**
   * Fetches continuation items from a paginated response
   * @async
   */
  async getContinuationItems(continuationToken) {
    try {
      const response = await this.makePostRequest('/youtubei/v1/browse?prettyPrint=false', {
        context: this.getInnertubeContext(),
        continuation: continuationToken
      });

      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetches all items in a playlist, handling pagination
   * @async
   * @param {string} playlistId - The ID of the playlist
   * @returns {Promise<Array<Track>>}
   */
  async getPlaylistItems(playlistId) {
    try {
      const response = await this.makePostRequest('/youtubei/v1/browse?prettyPrint=false', {
        context: this.getInnertubeContext(),
        browseId: `VL${playlistId}`
      });

      let allItems = [];

      if (response) {
        const records = response?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents
          ?.sectionListRenderer?.contents?.[0]?.musicPlaylistShelfRenderer?.contents;

        let continuationToken = records?.[records.length - 1]?.continuationItemRenderer
          ?.continuationEndpoint?.continuationCommand?.token;

        const items = YTMusicParser.parsePlaylistItemsFromResponse(records);
        allItems = allItems.concat(items);

        while (continuationToken) {
          const continuationResponse = await this.getContinuationItems(continuationToken);
          const continuationRecords = continuationResponse?.onResponseReceivedActions?.[0]
            ?.appendContinuationItemsAction?.continuationItems;

          continuationToken = continuationRecords?.[continuationRecords.length - 1]
            ?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;

          const continuationItems = YTMusicParser.parsePlaylistItemsFromResponse(continuationRecords);
          allItems = allItems.concat(continuationItems);
        }
      }

      return allItems;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Searches for music on YouTube Music
   * @async
   */
  async searchMusic(query) {
    const queryString = typeof query.toSearchQuery === 'function' 
      ? query.toSearchQuery() 
      : query.name;

    try {
      return await this.makePostRequest('/youtubei/v1/search?prettyPrint=false', {
        context: this.getInnertubeContext(),
        query: queryString.trim()
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Finds the best search result from search response
   * @param {Object} searchResponse - API search response
   * @param {Object|Track} originalQuery - The original query
   * @param {number} similarityThreshold - Similarity threshold
   * @returns {Track|null}
   */
  getBestSearchResult(searchResponse, originalQuery, similarityThreshold = CONSTANTS.API.SIMILARITY_THRESHOLD) {
    return YTMusicParser.getBestSearchResult(searchResponse, originalQuery, similarityThreshold);
  }

  /**
   * Adds a video to a playlist
   * @async
   */
  async addItemToPlaylist(playlistId, videoId) {
    try {
      const response = await this.makePostRequest('/youtubei/v1/browse/edit_playlist?prettyPrint=false', {
        context: this.getInnertubeContext(),
        actions: [
          {
            action: 'ACTION_ADD_VIDEO',
            addedVideoId: videoId,
            dedupeOption: 'DEDUPE_OPTION_CHECK'
          }
        ],
        playlistId: playlistId
      });

      return response?.status === 'STATUS_SUCCEEDED';
    } catch (error) {
      throw error;
    }
  }

  /**
   * Removes a video from a playlist
   * @async
   */
  async removeItemFromPlaylist(playlistId, videoId, playlistSetVideoId) {
    try {
      const response = await this.makePostRequest('/youtubei/v1/browse/edit_playlist?prettyPrint=false', {
        context: this.getInnertubeContext(),
        actions: [
          {
            action: 'ACTION_REMOVE_VIDEO',
            removedVideoId: videoId,
            setVideoId: playlistSetVideoId
          }
        ],
        playlistId: playlistId
      });

      const success = response?.status === 'STATUS_SUCCEEDED';
      if (!success) throw new Error(`Failed to remove video from playlist`);

      return success;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Extracts playlist ID from current page URL
   */
  getCurrentPlaylistIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('list');
  }
}
