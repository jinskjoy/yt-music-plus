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
        // Always parse all to ensure we have full counts in the future if needed,
        // but we filter here to keep the API contract.
        const playlists = YTMusicParser.parsePlaylistsFromResponse(response, false);
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

    const result = Array.from(allPlaylists.values());
    if (result.length > 0) {
      return onlyEditable ? result.filter(p => p.isEditable) : result;
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
      const browseId = playlistId.startsWith('VL') ? playlistId : `VL${playlistId}`;
      const response = await this.makePostRequest('/youtubei/v1/browse?prettyPrint=false', {
        context: this.getInnertubeContext(),
        browseId
      });

      let allItems = [];
      const records = this.extractPlaylistShelfRecords(response);
      const items = YTMusicParser.parsePlaylistItemsFromResponse(records);
      allItems = allItems.concat(items);

      let continuationToken = this.findContinuationToken(records, response);
      while (continuationToken) {
        const continuationResponse = await this.getContinuationItems(continuationToken);
        const continuationRecords = this.extractContinuationRecords(continuationResponse);

        if (!continuationRecords || continuationRecords.length === 0) break;

        const continuationItems = YTMusicParser.parsePlaylistItemsFromResponse(continuationRecords);
        allItems = allItems.concat(continuationItems);
        continuationToken = this.findContinuationToken(continuationRecords, continuationResponse);
      }

      return allItems;
    } catch (error) {
      throw error;
    }
  }

  extractPlaylistShelfRecords(response) {
    if (!response) return [];

    const contents = response?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents
      ?.sectionListRenderer?.contents;

    if (Array.isArray(contents)) {
      const shelf = contents.find(section => section?.musicPlaylistShelfRenderer)
        ?.musicPlaylistShelfRenderer?.contents;
      if (Array.isArray(shelf)) return shelf;
    }

    const continuationShelf = response?.continuationContents?.musicPlaylistShelfContinuation?.contents;
    if (Array.isArray(continuationShelf)) return continuationShelf;

    return [];
  }

  extractContinuationRecords(response) {
    if (!response) return [];

    const actions = response?.onResponseReceivedActions || response?.onResponseReceivedEndpoints || [];
    if (Array.isArray(actions)) {
      for (const action of actions) {
        const items = action?.appendContinuationItemsAction?.continuationItems
          || action?.reloadContinuationItemsAction?.continuationItems
          || action?.continuationItems;
        if (Array.isArray(items)) return items;
      }
    }

    const continuationShelf = response?.continuationContents?.musicPlaylistShelfContinuation?.contents;
    if (Array.isArray(continuationShelf)) return continuationShelf;

    return [];
  }

  findContinuationToken(items, response = null) {
    // 1. Check items array for continuationItemRenderer (common in continuation responses)
    if (Array.isArray(items)) {
      for (const item of items) {
        const renderer = item?.continuationItemRenderer;
        if (!renderer) continue;

        // Path A: Direct continuationEndpoint
        let token = renderer?.continuationEndpoint?.continuationCommand?.token
          || renderer?.continuationEndpoint?.token;
        
        // Path B: Nested in commandExecutorCommand (discovered in some responses)
        if (!token && renderer?.continuationEndpoint?.commandExecutorCommand?.commands) {
          const commands = renderer.continuationEndpoint.commandExecutorCommand.commands;
          const contCommand = commands.find(c => c?.continuationCommand?.token);
          token = contCommand?.continuationCommand?.token;
        }

        if (token) return token;
      }
    }

    // 2. Check response for continuations property (common in initial browse response)
    if (response) {
      // Path C: Browse response structure
      const browseContinuations = response?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents
        ?.sectionListRenderer?.contents?.find(c => c?.musicPlaylistShelfRenderer)
        ?.musicPlaylistShelfRenderer?.continuations;
      
      if (browseContinuations?.[0]?.nextContinuationData?.continuation) {
        return browseContinuations[0].nextContinuationData.continuation;
      }

      // Path D: Continuation response structure
      const continuationContinuations = response?.continuationContents?.musicPlaylistShelfContinuation?.continuations;
      if (continuationContinuations?.[0]?.nextContinuationData?.continuation) {
        return continuationContinuations[0].nextContinuationData.continuation;
      }
    }

    return null;
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
 * Adds multiple videos to a playlist
 * @async
 * @param {string} playlistId - The ID of the playlist
 * @param {Array<string>} videoIds - Array of video IDs to add
 * @returns {Promise<boolean>}
 */
async addItemsToPlaylist(playlistId, videoIds) {
  if (!videoIds || videoIds.length === 0) return true;

  try {
    const response = await this.makePostRequest('/youtubei/v1/browse/edit_playlist?prettyPrint=false', {
      context: this.getInnertubeContext(),
      actions: videoIds.map(videoId => ({
        action: 'ACTION_ADD_VIDEO',
        addedVideoId: videoId,
        dedupeOption: 'DEDUPE_OPTION_SKIP'
      })),
      playlistId: playlistId
    });

    return response?.status === 'STATUS_SUCCEEDED';
  } catch (error) {
    throw error;
  }
}

/**
 * Adds a video to a playlist
...
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
            dedupeOption: 'DEDUPE_OPTION_SKIP'
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
 * Removes multiple videos from a playlist
 * @async
 * @param {string} playlistId - The ID of the playlist
 * @param {Array<{videoId: string, setVideoId: string}>} items - Array of objects with videoId and setVideoId
 * @returns {Promise<boolean>}
 */
async removeItemsFromPlaylist(playlistId, items) {
  if (!items || items.length === 0) return true;

  try {
    const response = await this.makePostRequest('/youtubei/v1/browse/edit_playlist?prettyPrint=false', {
      context: this.getInnertubeContext(),
      actions: items.map(item => ({
        action: 'ACTION_REMOVE_VIDEO',
        removedVideoId: item.videoId,
        setVideoId: item.setVideoId
      })),
      playlistId: playlistId
    });

    return response?.status === 'STATUS_SUCCEEDED';
  } catch (error) {
    throw error;
  }
}

/**
 * Removes a video from a playlist
...
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
