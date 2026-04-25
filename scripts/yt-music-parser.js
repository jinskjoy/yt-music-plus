import * as Utils from '../utils/utils.js';
import { Playlist } from './models/playlist.js';
import { Track } from './models/track.js';

/**
 * YTMusicParser - Handles parsing of YouTube Music API responses
 */
export class YTMusicParser {
  static FILTER_TEXTS = [', ', ' & ', ' - ', 'Song', 'Video', ' • '];

  /**
   * Parses editable playlists from API response
   * @param {Object} data - API response data
   * @returns {Array<Playlist>}
   */
  static parseEditablePlaylistsFromResponse(data) {
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
          playlists.push(playlist);
        }
      });
    } catch (error) {
      throw error;
    }

    return playlists;
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
    const menuItems = renderer?.menu?.menuRenderer?.items || [];
    const playlistId = this.getPlaylistIdFromMenuItems(menuItems);
    if (!playlistId) return null;

    const title = this.parseTextField(renderer?.title);
    if (!title) return null;

    const subtitleRuns = renderer?.subtitle?.runs || [];
    const subtitle = subtitleRuns.map((run) => run?.text || '').join('').trim();
    const owner = subtitleRuns?.[0]?.text || '';
    const thumbnail = renderer?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || '';

    return new Playlist({
      id: playlistId,
      title,
      subtitle,
      owner,
      thumbnail
    });
  }

  /**
   * Extracts playlist ID from menu items
   */
  static getPlaylistIdFromMenuItems(menuItems) {
    for (const menuItem of menuItems) {
      const endpoint = menuItem?.menuNavigationItemRenderer?.navigationEndpoint || menuItem?.navigationEndpoint;
      if (!endpoint) continue;

      const playlistId = endpoint?.playlistEditorEndpoint?.playlistId
        || endpoint?.playlistEditEndpoint?.playlistId
        || endpoint?.browseEndpoint?.browseId;

      if (playlistId) return playlistId;
    }
    return null;
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
    track.checkMatch(originalTitle, threshold);

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

    for (const itemWrapper of itemRenderers) {
      const musicItemRenderer = itemWrapper?.musicResponsiveListItemRenderer;
      if (!musicItemRenderer) continue;

      const name = musicItemRenderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer
        ?.text?.runs?.[0]?.text || '';

      const artists = musicItemRenderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer
        ?.text?.runs?.map(run => run.text)
        .filter(text => !this.FILTER_TEXTS.includes(text)) || [];

      const isVideo = musicItemRenderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer
        ?.text?.runs?.some(run => run.text.toUpperCase() === 'VIDEO');

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
        track.checkMatch(originalTitle, threshold);

        return track;
      }
    }
    return null;
  }
}
