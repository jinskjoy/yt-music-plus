import { CONSTANTS } from '../utils/constants.js';

/**
 * PlayerHandler - Handles playback controls within the YouTube Music UI
 * Provides play, pause, and seek functionality for each track
 */
export class PlayerHandler {
  constructor() {
    this.initialized = false;
    this.retryCount = 0;
    this.maxRetries = CONSTANTS.PLAYER.MAX_RETRIES;
  }

  /**
   * Centralized getter for the player API
   * @returns {Object|null}
   */
  get api() {
    const app = document.querySelector('ytmusic-app');
    return app?.playerApi || null;
  }

  /**
   * Initializes the PlayerHandler
   */
  init() {
    if (this.initialized) return;
    
    if (!this.api) {
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        setTimeout(() => this.init(), CONSTANTS.PLAYER.RETRY_INTERVAL_MS);
      } else {
        console.error('PlayerHandler: Failed to initialize after max retries.');
      }
      return;
    }

    this.initialized = true;
    this.retryCount = 0;
  }

  /**
   * Playback actions
   */
  playTrack(videoId) {
    const playerApi = this.api;
    if (!playerApi) return;
    
    // Check if it's already the current video
    const currentVideoId = playerApi.getVideoData()?.video_id;
    if (currentVideoId === videoId) {
      playerApi.playVideo();
    } else {
      playerApi.loadVideoById(videoId);
    }
  }

  pauseTrack() {
    this.api?.pauseVideo();
  }

  seekBy(seconds) {
    this.api?.seekBy(seconds);
  }

  /**
   * Additional player methods
   */
  getVideoData() {
    return this.api?.getVideoData() || null;
  }

  nextTrack() {
    this.api?.nextVideo();
  }

  previousTrack() {
    this.api?.previousVideo();
  }

  getVolume() {
    return this.api?.getVolume() || 0;
  }

  setVolume(volume) {
    this.api?.setVolume(volume);
  }

  isMuted() {
    return this.api?.isMuted() || false;
  }

  mute() {
    this.api?.mute();
  }

  unMute() {
    this.api?.unMute();
  }

  getCurrentTime() {
    return this.api?.getCurrentTime() || 0;
  }

  getDuration() {
    return this.api?.getDuration() || 0;
  }

  /**
   * Gets the current state of the player
   * @returns {number} Value from CONSTANTS.PLAYER.STATE
   */
  getPlayerState() {
    return this.api?.getPlayerState() || 0;
  }
}
