import { UIHelper } from '../utils/ui-helper.js';

/**
 * YTMusicAPI - Handles all YouTube Music API interactions
 * Provides methods for playlist management, search, and item manipulation
 */
export class YTMusicAPI {
  // Constants
  static INNERTUBE_ENDPOINT = 'https://music.youtube.com';
  static SIMILARITY_THRESHOLD = 0.5;
  static FILTER_TEXTS = [', ', ' & ', ' - ', 'Song', 'Video', ' • '];

  constructor() {
    this.baseURL = YTMusicAPI.INNERTUBE_ENDPOINT;
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
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Response data
   */
  async makeGetRequest(endpoint, params = {}) {
    const url = new URL(this.baseURL + endpoint);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': this.authToken || ''
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Makes a POST request to the YouTube Music API
   * @async
   * @param {string} endpoint - API endpoint
   * @param {Object} body - Request body
   * @returns {Promise<Object>} Response data
   */
  async makePostRequest(endpoint, body = {}) {
    const url = this.baseURL + endpoint;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': '*/*',
        'Authorization': this.authToken || ''
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Sets authentication token for API requests
   * @param {string} token - Authorization token
   */
  setAuthToken(token) {
    this.authToken = token;
  }

  /**
   * Fetches all editable playlists for the current user
   * @async
   * @returns {Promise<Array>} Array of playlist objects
   */
  async getEditablePlaylists() {
    try {
      const response = await this.makePostRequest('/youtubei/v1/browse?prettyPrint=false', {
        context: window.ytcfg.data_.INNERTUBE_CONTEXT,
        browseId: 'FEmusic_liked_playlists'
      });

      return this.parseEditablePlaylistsFromResponse(response);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Parses editable playlists from API response
   * @param {Object} data - API response data
   * @returns {Array} Array of playlist objects
   */
  parseEditablePlaylistsFromResponse(data) {
    const playlists = [];

    try {
      const items = data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
        ?.sectionListRenderer?.contents?.[0]?.gridRenderer?.items || [];

      items.forEach((item) => {
        const renderer = item?.musicTwoRowItemRenderer;
        if (!renderer) return;

        // Check for edit permissions
        const menu = renderer?.menu?.menuRenderer?.items || [];
        const hasEditPermission = menu.some((menuItem) =>
          menuItem?.menuNavigationItemRenderer?.navigationEndpoint?.playlistEditorEndpoint?.playlistId
        );

        if (!hasEditPermission) return;

        // Extract playlist ID
        let playlistId = null;
        menu.forEach((menuItem) => {
          if (menuItem?.menuNavigationItemRenderer?.navigationEndpoint?.playlistEditorEndpoint?.playlistId) {
            playlistId = menuItem.menuNavigationItemRenderer.navigationEndpoint.playlistEditorEndpoint.playlistId;
          }
        });

        // Extract playlist details
        const title = renderer?.title?.runs?.[0]?.text || '';
        const subtitleRuns = renderer?.subtitle?.runs || [];
        const subtitle = subtitleRuns.map((run) => run?.text || '').join('').trim();
        const owner = subtitleRuns?.[0]?.text || '';
        const thumbnail = renderer?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.pop()?.url || '';

        if (title && playlistId) {
          playlists.push({
            id: playlistId,
            title: title,
            subtitle: subtitle,
            owner: owner,
            thumbnail: thumbnail
          });
        }
      });
    } catch (error) {
      throw error;
    }

    return playlists;
  }

  /**
   * Fetches continuation items from a paginated response
   * @async
   * @param {string} continuationToken - Continuation token from previous response
   * @returns {Promise<Object>} Continuation response
   */
  async getContinuationItems(continuationToken) {
    try {
      const response = await this.makePostRequest('/youtubei/v1/browse?prettyPrint=false', {
        context: window.ytcfg.data_.INNERTUBE_CONTEXT,
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
   * @param {string} playlistId - Playlist ID
   * @returns {Promise<Array>} Array of playlist items
   */
  async getPlaylistItems(playlistId) {
    try {
      const response = await this.makePostRequest('/youtubei/v1/browse?prettyPrint=false', {
        context: window.ytcfg.data_.INNERTUBE_CONTEXT,
        browseId: `VL${playlistId}`
      });

      let allItems = [];

      if (response) {
        const records = response?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents
          ?.sectionListRenderer?.contents?.[0]?.musicPlaylistShelfRenderer?.contents;

        let continuationToken = records?.[records.length - 1]?.continuationItemRenderer
          ?.continuationEndpoint?.continuationCommand?.token;

        const items = this.parsePlaylistItemsFromResponse(records);
        allItems = allItems.concat(items);

        // Fetch paginated results
        while (continuationToken) {
          const continuationResponse = await this.getContinuationItems(continuationToken);
          const continuationRecords = continuationResponse?.onResponseReceivedActions?.[0]
            ?.appendContinuationItemsAction?.continuationItems;

          continuationToken = continuationRecords?.[continuationRecords.length - 1]
            ?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;

          const continuationItems = this.parsePlaylistItemsFromResponse(continuationRecords);
          allItems = allItems.concat(continuationItems);
        }
      }

      return allItems;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Parses playlist items from API response
   * @param {Array} itemRenderers - Item renderer array
   * @returns {Array} Parsed item objects
   */
  parsePlaylistItemsFromResponse(itemRenderers) {
    if (!itemRenderers) return [];

    const items = [];

    try {
      itemRenderers.forEach((itemWrapper) => {
        const musicItemRenderer = itemWrapper?.musicResponsiveListItemRenderer;

        if (musicItemRenderer) {
          const name = musicItemRenderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer
            ?.text?.runs?.[0]?.text || '';

          const artists = musicItemRenderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer
            ?.text?.runs?.map(run => run.text).filter(text => text !== ', ' && text !== ' & ') || [];

          const album = musicItemRenderer?.flexColumns?.[2]?.musicResponsiveListItemFlexColumnRenderer
            ?.text?.runs?.[0]?.text || '';

          const duration = musicItemRenderer?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer
            ?.text?.runs?.[0]?.text || '';

          const thumbnailUrl = musicItemRenderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url || '';

          const isGreyedOut = musicItemRenderer?.musicItemRendererDisplayPolicy 
            === 'MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT';

          const videoId = musicItemRenderer?.playlistItemData?.videoId || '';
          const playlistSetVideoId = musicItemRenderer?.playlistItemData?.playlistSetVideoId || '';

          const musicVideoType = musicItemRenderer?.overlay?.musicItemThumbnailOverlayRenderer?.content
            ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint
            ?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType;

          const isVideo = musicVideoType === 'MUSIC_VIDEO_TYPE_UGC';

          if (name) {
            items.push({
              name: name,
              artists: artists,
              album: album,
              duration: duration,
              thumbnail: thumbnailUrl,
              isGreyedOut: isGreyedOut,
              videoId: videoId,
              playlistSetVideoId: playlistSetVideoId,
              isVideo: isVideo
            });
          }
        }
      });
    } catch (error) {
      throw error;
    }

    return items;
  }

  /**
   * Searches for music on YouTube Music
   * @async
   * @param {Object} query - Search query with name, artists, album
   * @returns {Promise<Object>} Search response
   */
  async searchMusic(query) {
    // Build search string from name, album, and artists
    let queryString = query.name;

    if (query.album) {
      queryString += ' - ' + query.album;
    }

    if (query.artists?.length > 0) {
      queryString += ' - ' + query.artists.join(' ');
    }

    try {
      const response = await this.makePostRequest('/youtubei/v1/search?prettyPrint=false', {
        context: window.ytcfg.data_.INNERTUBE_CONTEXT,
        query: queryString.trim()
      });

      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Finds the best search result from search response
   * @param {Object} searchResponse - Search API response
   * @param {Object} originalQuery - Original query object
   * @param {number} similarityThreshold - Similarity threshold (0-1)
   * @returns {Object|null} Best matching result or null
   */
  getBestSearchResult(searchResponse, originalQuery, similarityThreshold = YTMusicAPI.SIMILARITY_THRESHOLD) {
    try {
      const sections = searchResponse?.contents?.tabbedSearchResultsRenderer?.tabs
        ?.find(t => t.tabRenderer.tabIdentifier === 'music_search_catalog')?.tabRenderer?.content
        ?.sectionListRenderer?.contents || [];

      // Check card results first (featured results)
      for (const section of sections) {
        const cardResult = this.parseCardResult(section?.musicCardShelfRenderer, 
          originalQuery.name, similarityThreshold);
        if (cardResult) return cardResult;

        // Check shelf results (list of results)
        const shelfResult = this.parseShelfResults(section?.musicShelfRenderer, 
          originalQuery.name, similarityThreshold);
        if (shelfResult) return shelfResult;
      }

      return null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Parses a card result from search response
   * @param {Object} cardShelf - Card shelf object
   * @param {string} originalTitle - Original track title
   * @param {number} threshold - Similarity threshold
   * @returns {Object|null} Parsed result or null
   */
  parseCardResult(cardShelf, originalTitle, threshold) {
    if (!cardShelf) return null;

    const isMusicItem = cardShelf?.subtitle?.runs?.some(run => 
      run.text.toUpperCase() === 'SONG' || run.text.toUpperCase() === 'VIDEO'
    );

    if (!isMusicItem) return null;

    const name = cardShelf?.title?.runs?.[0]?.text || '';
    const thumbnail = cardShelf?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url || '';
    const videoId = cardShelf?.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId || '';
    const subtitleRuns = cardShelf?.subtitle?.runs || [];
    const subtitleText = subtitleRuns.map(run => run.text).join('');

    // Extract duration (last part with digits:digits pattern)
    const durationMatch = subtitleText.match(/(\d+:\d+)$/);
    const duration = durationMatch ? durationMatch[1] : '';

    // Extract artists from subtitle, filtering out separators and type indicators
    const artists = subtitleRuns
      .map(run => run.text)
      .filter(text => text !== ' • ' && text !== ' & ' && !text.match(/^\d+:\d+$/) && text !== 'Song')
      .filter(text => text.trim() !== '');

    const isSong = subtitleRuns.some(run => run.text.toUpperCase() === 'SONG');
    const isVideo = subtitleRuns.some(run => run.text.toUpperCase() === 'VIDEO');

    if (!name) return null;

    return {
      name: name,
      artists: artists,
      album: '',
      duration: duration,
      thumbnail: thumbnail,
      videoId: videoId,
      isVideo: isVideo,
      isGoodMatch: this.isGoodMatch(originalTitle, name, threshold)
    };
  }

  /**
   * Parses shelf (list) results from search response
   * @param {Object} musicShelf - Shelf object
   * @param {string} originalTitle - Original track title
   * @param {number} threshold - Similarity threshold
   * @returns {Object|null} First matching result or null
   */
  parseShelfResults(musicShelf, originalTitle, threshold) {
    if (!musicShelf) return null;

    const itemRenderers = musicShelf?.contents || [];

    for (const itemWrapper of itemRenderers) {
      const musicItemRenderer = itemWrapper?.musicResponsiveListItemRenderer;
      if (!musicItemRenderer) continue;

      const name = musicItemRenderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer
        ?.text?.runs?.[0]?.text || '';

      const artists = musicItemRenderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer
        ?.text?.runs?.map(run => run.text)
        .filter(text => !YTMusicAPI.FILTER_TEXTS.includes(text)) || [];

      const isSong = musicItemRenderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer
        ?.text?.runs?.some(run => run.text.toUpperCase() === 'SONG');

      const isVideo = musicItemRenderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer
        ?.text?.runs?.some(run => run.text.toUpperCase() === 'VIDEO');

      const album = musicItemRenderer?.flexColumns?.[2]?.musicResponsiveListItemFlexColumnRenderer
        ?.text?.runs?.[0]?.text || '';

      const duration = musicItemRenderer?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer
        ?.text?.runs?.[0]?.text || '';

      const thumbnailUrl = musicItemRenderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url || '';
      const videoId = musicItemRenderer?.playlistItemData?.videoId || '';

      if (name) {
        return {
          name: name,
          artists: artists,
          album: album,
          duration: duration,
          thumbnail: thumbnailUrl,
          videoId: videoId,
          isVideo: isVideo,
          isGoodMatch: this.isGoodMatch(originalTitle, name, threshold)
        };
      }
    }

    return null;
  }

  /**
   * Determines if a search result is a good match for the original title
   * @param {string} originalTitle - Original track title
   * @param {string} searchResultTitle - Search result title
   * @param {number} similarityThreshold - Similarity threshold
   * @returns {boolean} Whether the match is good
   */
  isGoodMatch(originalTitle, searchResultTitle, similarityThreshold) {
    if (!searchResultTitle) {
      return false;
    }

    return UIHelper.isGoodMatch(originalTitle, searchResultTitle, similarityThreshold);
  }

  /**
   * Adds a video to a playlist
   * @async
   * @param {string} playlistId - Playlist ID
   * @param {string} videoId - Video ID to add
   * @returns {Promise<boolean>} Success status
   */
  async addItemToPlaylist(playlistId, videoId) {
    try {
      const response = await this.makePostRequest('/youtubei/v1/browse/edit_playlist?prettyPrint=false', {
        context: window.ytcfg.data_.INNERTUBE_CONTEXT,
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
   * @param {string} playlistId - Playlist ID
   * @param {string} videoId - Video ID to remove
   * @param {string} playlistSetVideoId - Playlist set video ID
   * @returns {Promise<boolean>} Success status
   */
  async removeItemFromPlaylist(playlistId, videoId, playlistSetVideoId) {
    try {
      const response = await this.makePostRequest('/youtubei/v1/browse/edit_playlist?prettyPrint=false', {
        context: window.ytcfg.data_.INNERTUBE_CONTEXT,
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

      if (!success) {
        throw new Error(`Failed to remove video from playlist`);
      }

      return success;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Extracts playlist ID from current page URL
   * @returns {string|null} Playlist ID or null if not on playlist page
   */
  getCurrentPlaylistIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('list');
  }
}