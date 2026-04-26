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
    this.localPlayer = null;
    this.currentLocalFile = null;
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
    // Stop local player if running
    this.pauseLocalTrack();

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

  playLocalFile(file) {
    if (!file) return;

    // Pause YouTube player
    this.api?.pauseVideo();

    if (!this.localPlayer) {
      this.localPlayer = new Audio();
    }

    if (this.currentLocalFile !== file) {
      if (this.localPlayer.src) {
        URL.revokeObjectURL(this.localPlayer.src);
      }
      this.localPlayer.src = URL.createObjectURL(file);
      this.currentLocalFile = file;
    }

    this.localPlayer.play();
  }

  pauseTrack() {
    this.api?.pauseVideo();
    this.pauseLocalTrack();
  }

  pauseLocalTrack() {
    if (this.localPlayer && !this.localPlayer.paused) {
      this.localPlayer.pause();
    }
  }

  seekBy(seconds) {
    if (this.localPlayer && !this.localPlayer.paused) {
      this.localPlayer.currentTime += seconds;
    } else {
      this.api?.seekBy(seconds);
    }
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
    if (this.localPlayer && !this.localPlayer.paused) {
      return CONSTANTS.PLAYER.STATE.PLAYING;
    }
    return this.api?.getPlayerState() ?? CONSTANTS.PLAYER.STATE.UNSTARTED;
  }

  /**
   * Checks if a local file is currently playing
   * @param {File} file 
   * @returns {boolean}
   */
  isLocalFilePlaying(file) {
    return this.localPlayer && !this.localPlayer.paused && this.currentLocalFile === file;
  }
}
