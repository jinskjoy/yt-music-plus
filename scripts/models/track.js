import { TextSimilarity } from '../../utils/utils.js';

/**
 * Track - Represents a music track in YouTube Music
 */
export class Track {
  static GENERIC_NAME_REGEX = /^\d*\s*(?:-|_)?\s*(?:(?:unknown|untitled|misc)(?:\s*artist)?\s*(?:-|_)?\s*)?(?:track|audio\s*track|unknown|untitled|misc)\s*\d*$/i;
  static VIDEO_SUFFIX_REGEX = /(official\s*)?(music\s*)?video/gi;

  /**
   * @param {Object} params
   * @param {string} params.name - Track name
   * @param {Array<string>} [params.artists] - List of artists
   * @param {string} [params.album] - Album name
   * @param {string} [params.duration] - Track duration (e.g., "3:45")
   * @param {string} [params.thumbnail] - URL to track thumbnail
   * @param {boolean} [params.isGreyedOut] - Whether the track is unavailable
   * @param {string} [params.videoId] - YouTube video ID
   * @param {string} [params.playlistSetVideoId] - Unique ID for the track in a playlist
   * @param {boolean} [params.isVideo] - Whether the track is a video
   * @param {boolean} [params.isLocal] - Whether the track was imported locally
   * @param {boolean} [params.isGeneric] - Whether the track name is generic (e.g., "Track 01")
   * @param {boolean} [params.isSearching] - Current search status
   * @param {boolean} [params.searchCancelled] - Whether searching was cancelled
   * @param {boolean} [params.isSkipped] - Whether the track was skipped during processing
   * @param {Track|Object} [params.replacement] - Found replacement track
   */
  constructor({
    name,
    artists = [],
    album = '',
    duration = '',
    thumbnail = '',
    isGreyedOut = false,
    videoId = '',
    playlistSetVideoId = '',
    isVideo = false,
    isLocal = false,
    isGeneric = false,
    isSearching = false,
    searchCancelled = false,
    isSkipped = false,
    replacement = null
  }) {
    this.name = name;
    this.artists = artists;
    this.album = album;
    this.duration = duration;
    this.thumbnail = thumbnail;
    this.isGreyedOut = isGreyedOut;
    this.videoId = videoId;
    this.playlistSetVideoId = playlistSetVideoId;
    this.isVideo = isVideo;
    this.isLocal = isLocal;
    this.isGeneric = isGeneric;
    this.isSearching = isSearching;
    this.searchCancelled = searchCancelled;
    this.isSkipped = isSkipped;
    
    this.replacement = null;
    if (replacement) {
      this.replacement = replacement instanceof Track ? replacement : new Track(replacement);
    }

    this._isGoodMatch = false;
    this.matchScore = 0;
  }

  /**
   * Returns a comma-separated string of artists
   * @returns {string}
   */
  get artistsString() {
    return this.artists.join(', ');
  }

  /**
   * Returns a search query string for this track
   * @returns {string}
   */
  toSearchQuery() {
    const cleanName = this.name.replace(Track.VIDEO_SUFFIX_REGEX, '').trim();
    let query = cleanName;
    if (this.album) query += ` - ${this.album}`;
    if (this.artists && this.artists.length > 0) {
      query += ` - ${this.artistsString}`;
    }
    return query;
  }

  /**
   * Gets the match status
   * @returns {boolean}
   */
  get isGoodMatch() {
    return this._isGoodMatch;
  }

  /**
   * Sets the match status
   * @param {boolean} value
   */
  set isGoodMatch(value) {
    this._isGoodMatch = value;
  }

  /**
   * Checks if this track matches another track based on title similarity
   * and updates the match status and score.
   * @param {string} otherTitle - Title to compare with
   * @param {number} threshold - Similarity threshold
   * @returns {boolean}
   */
  updateMatchStatus(otherTitle, threshold = 0.5) {
    this.matchScore = TextSimilarity.calculateJaroWinklerDistance(otherTitle, this.name);
    this.isGoodMatch = this.matchScore >= threshold;
    return this.isGoodMatch;
  }

  /**
   * Creates a Track instance from a plain object
   * @param {Object} data 
   * @returns {Track}
   */
  static fromJSON(data) {
    return new Track(data);
  }
}
