import { Playlist } from './models/playlist.js';
import { Track } from './models/track.js';
import { CONSTANTS } from '../utils/constants.js';

/**
 * YTMusicParser - Handles parsing of YouTube Music API responses
 */
export class YTMusicParser {
  /**
   * Parses playlists from API response
   * @param {Object} data - API response data
   * @param {boolean} onlyEditable - Whether to only return editable playlists
   * @returns {Array<Playlist>}
   */
  static parsePlaylistsFromResponse(data, onlyEditable = false) {
    const playlists = [];
    if (!data) return playlists;

    try {
      const sections = data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
        ?.sectionListRenderer?.contents || [];

      const items = [];
      sections.forEach((section) => {
        if (section?.gridRenderer?.items) {
          items.push(...section.gridRenderer.items);
        }
        if (section?.musicShelfRenderer?.contents) {
          items.push(...section.musicShelfRenderer.contents);
        }
        if (section?.itemSectionRenderer?.contents) {
          items.push(...section.itemSectionRenderer.contents);
        }
        if (section?.carouselShelfRenderer?.contents) {
          items.push(...section.carouselShelfRenderer.contents);
        }
      });

      items.forEach((item) => {
        const renderer = item?.musicTwoRowItemRenderer || this.findRenderer(item, 'musicTwoRowItemRenderer');
        if (!renderer) return;

        const playlist = this.extractPlaylistFromMusicTwoRowRenderer(renderer);
        if (playlist) {
          if (!onlyEditable || playlist.isEditable) {
            playlists.push(playlist);
          }
        }
      });
    } catch (error) {
      throw error;
    }

    return playlists;
  }

  /**
   * Backward compatibility for parseEditablePlaylistsFromResponse
   */
  static parseEditablePlaylistsFromResponse(data) {
    return this.parsePlaylistsFromResponse(data, true);
  }

  /**
   * Recursively finds a renderer by key in an object
   */
  static findRenderer(obj, key) {
    if (!obj || typeof obj !== 'object') return null;
    if (obj[key]) return obj[key];

    for (const value of Object.values(obj)) {
      if (typeof value === 'object') {
        const found = this.findRenderer(value, key);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Extracts playlist details from musicTwoRowItemRenderer
   * @param {Object} renderer - The renderer object
   * @returns {Playlist|null}
   */
  static extractPlaylistFromMusicTwoRowRenderer(renderer) {
    const subtitleRuns = renderer?.subtitle?.runs || [];
    const subtitle = subtitleRuns.map((run) => run?.text || '').join('').trim();
    
    // Determine if this is actually a playlist or album (which we treat as playlist)
    const isPlaylist = subtitleRuns.some(run => {
      const text = run?.text || '';
      return text.includes('Playlist') || text.includes('Auto playlist') || text.includes('Album');
    });

    const menuItems = renderer?.menu?.menuRenderer?.items || [];
    const playlistInfo = this.getPlaylistInfoFromMenuItems(menuItems);
    
    // Prioritize renderer's own navigation endpoint for ID
    const endpoint = renderer?.navigationEndpoint;
    let id = endpoint?.browseEndpoint?.browseId || endpoint?.watchPlaylistEndpoint?.playlistId;
    
    // If we have a browseId that is likely an Artist (starts with UC), use menu info instead
    if (!id || id.startsWith('UC')) {
      id = playlistInfo.id;
    }
    
    // If still no ID, or if it's definitely not a playlist/album, skip
    if (!id || (!isPlaylist && !id.startsWith('VL') && !id.startsWith('PL') && id !== 'VLLM')) {
      return null;
    }
    
    // Cleanup ID (strip VL prefix if present)
    if (id.startsWith('VL')) id = id.substring(2);

    const title = this.parseTextField(renderer?.title);
    if (!title) return null;

    // Find the owner in subtitle runs (usually the run with a browseEndpoint)
    let owner = '';
    const ownerRun = subtitleRuns.find(run => run?.navigationEndpoint?.browseEndpoint);
    if (ownerRun) {
      owner = ownerRun.text || '';
    } else if (subtitleRuns.length > 0) {
      // Fallback: if it's "Playlist • Name • Count", owner is index 2
      if (subtitleRuns.length >= 3 && (subtitleRuns[0].text === 'Playlist' || subtitleRuns[0].text === 'Album')) {
        owner = subtitleRuns[2].text || '';
      } else {
        owner = subtitleRuns[0].text || '';
      }
    }

    const thumbnail = renderer?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || '';

    // Final editability check using menu text runs as well
    const isEditable = playlistInfo.isEditable || this.isPlaylistEditable(menuItems);

    return new Playlist({
      id,
      title,
      subtitle,
      owner,
      thumbnail,
      isEditable
    });
  }

  /**
   * Checks if a playlist is editable based on menu items
   * @param {Array} menuItems - Array of menu items
   * @returns {boolean}
   */
  static isPlaylistEditable(menuItems) {
    if (!menuItems || !Array.isArray(menuItems)) return false;
    
    const editKeywords = CONSTANTS.PARSER.EDIT_KEYWORDS;
    
    for (const item of menuItems) {
      const renderer = item?.menuNavigationItemRenderer || item?.menuServiceItemRenderer;
      if (renderer?.text?.runs) {
        const text = renderer.text.runs.map(run => run?.text || '').join('').toLowerCase();
        if (editKeywords.some(keyword => text.includes(keyword))) return true;
      }
      
      const endpoint = renderer?.navigationEndpoint || renderer?.serviceEndpoint;
      if (endpoint?.playlistEditorEndpoint || endpoint?.playlistEditEndpoint) return true;
    }
    return false;
  }

  /**
   * Extracts playlist info (ID and editability) from menu items
   */
  static getPlaylistInfoFromMenuItems(menuItems) {
    let id = null;
    let isEditable = false;

    if (!menuItems || !Array.isArray(menuItems)) {
      return { id, isEditable };
    }

    for (const menuItem of menuItems) {
      const renderer = menuItem?.menuNavigationItemRenderer || menuItem?.menuServiceItemRenderer || menuItem?.toggleMenuServiceItemRenderer;
      if (!renderer) continue;

      const endpoint = renderer?.navigationEndpoint || renderer?.serviceEndpoint || renderer?.defaultServiceEndpoint;
      
      // Check for editability
      if (endpoint?.playlistEditorEndpoint || endpoint?.playlistEditEndpoint) {
        isEditable = true;
      }
      
      // Look for playlist ID in various endpoints
      const playlistId = endpoint?.playlistEditorEndpoint?.playlistId
        || endpoint?.playlistEditEndpoint?.playlistId
        || endpoint?.watchPlaylistEndpoint?.playlistId
        || endpoint?.addToPlaylistEndpoint?.playlistId
        || endpoint?.queueAddEndpoint?.queueTarget?.playlistId
        || endpoint?.likeEndpoint?.target?.playlistId
        || endpoint?.browseEndpoint?.browseId
        // Also check nested delete endpoint
        || endpoint?.confirmDialogEndpoint?.content?.confirmDialogRenderer?.confirmButton?.buttonRenderer?.serviceEndpoint?.deletePlaylistEndpoint?.playlistId;

      if (playlistId) {
        // Prioritize non-Mix IDs. If we have a regular ID, don't overwrite it with a Mix ID (starts with RD)
        if (!id || (id.startsWith('RD') && !playlistId.startsWith('RD'))) {
          id = playlistId;
        }
      }
    }

    return { id, isEditable };
  }

  /**
   * Extracts playlist ID from menu items
   * @deprecated Use getPlaylistInfoFromMenuItems
   */
  static getPlaylistIdFromMenuItems(menuItems) {
    return this.getPlaylistInfoFromMenuItems(menuItems).id;
  }

  /**
   * Parses text fields from various formats (simpleText, runs, string)
   */
  static parseTextField(field) {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (field.simpleText) return field.simpleText;
    if (Array.isArray(field.runs)) {
      return field.runs.map((run) => run?.text || '').join('');
    }
    return '';
  }

  /**
   * Parses playlist items from response
   * @param {Array} itemRenderers - Array of item renderers
   * @returns {Array<Track>}
   */
  static parsePlaylistItemsFromResponse(itemRenderers) {
    if (!itemRenderers) return [];
    const items = [];

    try {
      itemRenderers.forEach((itemWrapper) => {
        const musicItemRenderer = itemWrapper?.musicResponsiveListItemRenderer;
        if (musicItemRenderer) {
          const name = musicItemRenderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer
            ?.text?.runs?.[0]?.text || '';

          const artists = musicItemRenderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer
            ?.text?.runs?.map(run => run.text).filter(text => !CONSTANTS.PARSER.FILTER_TEXTS.includes(text)) || [];

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
            items.push(new Track({
              name,
              artists,
              album,
              duration,
              thumbnail: thumbnailUrl,
              isGreyedOut,
              videoId,
              playlistSetVideoId,
              isVideo
            }));
          }
        }
      });
    } catch (error) {
      throw error;
    }

    return items;
  }

  /**
   * Finds the best search result from search response
   * @param {Object} searchResponse - API search response
   * @param {Object|Track} originalQuery - The original query (name, artists, etc.)
   * @param {number} similarityThreshold - Threshold for Jaro-Winkler similarity
   * @returns {Track|null}
   */
  static getBestSearchResult(searchResponse, originalQuery, similarityThreshold) {
    try {
      const sections = searchResponse?.contents?.tabbedSearchResultsRenderer?.tabs
        ?.find(t => t.tabRenderer.tabIdentifier === 'music_search_catalog')?.tabRenderer?.content
        ?.sectionListRenderer?.contents || [];

      for (const section of sections) {
        const cardResult = this.parseCardResult(section?.musicCardShelfRenderer, 
          originalQuery.name, similarityThreshold);
        if (cardResult) return cardResult;

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
   * @param {Object} cardShelf - Card shelf renderer
   * @param {string} originalTitle - Original track title for matching
   * @param {number} threshold - Similarity threshold
   * @returns {Track|null}
   */
  static parseCardResult(cardShelf, originalTitle, threshold) {
    if (!cardShelf) return null;

    const isMusicItem = cardShelf?.subtitle?.runs?.some(run => 
      run.text.toUpperCase() === 'SONG' || run.text.toUpperCase() === 'VIDEO'
    );
    if (!isMusicItem) return null;

    const name = cardShelf?.title?.runs?.[0]?.text || '';
    const thumbnail = cardShelf?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url || '';
    const videoId = cardShelf?.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId 
      || cardShelf?.buttons?.[0]?.buttonRenderer?.command?.watchEndpoint?.videoId 
      || '';
    const subtitleRuns = cardShelf?.subtitle?.runs || [];
    const subtitleText = subtitleRuns.map(run => run.text).join('');

    const durationMatch = subtitleText.match(/(\d+:\d+)$/);
    const duration = durationMatch ? durationMatch[1] : '';

    const artists = subtitleRuns
      .map(run => run.text)
      .filter(text => text !== ' • ' && text !== ' & ' && !text.match(/^\d+:\d+$/) && text !== 'Song')
      .filter(text => text.trim() !== '');

    const isVideo = subtitleRuns.some(run => run.text.toUpperCase() === 'VIDEO');
    if (!name) return null;

    const track = new Track({
      name,
      artists,
      album: '',
      duration,
      thumbnail,
      videoId,
      isVideo
    });
    track.updateMatchStatus(originalTitle, threshold);

    return track;
  }

  /**
   * Parses shelf (list) results from search response
   * @param {Object} musicShelf - Music shelf renderer
   * @param {string} originalTitle - Original track title for matching
   * @param {number} threshold - Similarity threshold
   * @returns {Track|null}
   */
  static parseShelfResults(musicShelf, originalTitle, threshold) {
    if (!musicShelf) return null;
    const itemRenderers = musicShelf?.contents || [];
    const potentialTracks = [];

    for (const itemWrapper of itemRenderers) {
      const musicItemRenderer = itemWrapper?.musicResponsiveListItemRenderer;
      if (!musicItemRenderer) continue;

      const subtitleRuns = musicItemRenderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
      const isSong = subtitleRuns.some(run => run.text.toUpperCase() === 'SONG');
      const isVideo = subtitleRuns.some(run => run.text.toUpperCase() === 'VIDEO');

      // Only Audio and Video should be considered. Playlists, Artists, etc. should be ignored.
      if (!isSong && !isVideo) continue;

      const name = musicItemRenderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer
        ?.text?.runs?.[0]?.text || '';

      const artists = subtitleRuns
        .map(run => run.text)
        .filter(text => !CONSTANTS.PARSER.FILTER_TEXTS.includes(text)) || [];

      const album = musicItemRenderer?.flexColumns?.[2]?.musicResponsiveListItemFlexColumnRenderer
        ?.text?.runs?.[0]?.text || '';

      const duration = musicItemRenderer?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer
        ?.text?.runs?.[0]?.text || '';

      const thumbnailUrl = musicItemRenderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url || '';
      const videoId = musicItemRenderer?.playlistItemData?.videoId 
        || musicItemRenderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId 
        || musicItemRenderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId 
        || '';

      if (name) {
        const track = new Track({
          name,
          artists,
          album,
          duration,
          thumbnail: thumbnailUrl,
          videoId,
          isVideo
        });
        track.updateMatchStatus(originalTitle, threshold);
        potentialTracks.push(track);
      }
    }

    if (potentialTracks.length === 0) return null;

    // Sort by match score descending and return the best one
    return potentialTracks.sort((a, b) => b.matchScore - a.matchScore)[0];
  }
}
