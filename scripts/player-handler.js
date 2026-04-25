/**
 * PlayerHandler - Handles playback controls within the YouTube Music UI
 * Provides play, pause, and seek functionality for each track
 */
export class PlayerHandler {
  constructor() {
    this.initialized = false;
    this.retryCount = 0;
    this.maxRetries = 10;
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
        setTimeout(() => this.init(), 1000);
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
}
