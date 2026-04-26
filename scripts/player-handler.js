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
    this.activeSource = CONSTANTS.PLAYER.SOURCE.YOUTUBE;
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
    this.activeSource = CONSTANTS.PLAYER.SOURCE.YOUTUBE;

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
    this.activeSource = CONSTANTS.PLAYER.SOURCE.LOCAL;

    if (!this.localPlayer) {
      this.localPlayer = new Audio();
      
      // Add event listener to handle ended state
      this.localPlayer.addEventListener('ended', () => {
        // You might want to trigger next track here in the future
      });
    }

    if (this.currentLocalFile !== file) {
      if (this.localPlayer.src) {
        URL.revokeObjectURL(this.localPlayer.src);
      }
      this.localPlayer.src = URL.createObjectURL(file);
      this.currentLocalFile = file;
    }

    this.localPlayer.play().catch(error => {
      console.error('PlayerHandler: Local playback failed', error);
      this.activeSource = CONSTANTS.PLAYER.SOURCE.YOUTUBE;
    });
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
    if (this.activeSource === CONSTANTS.PLAYER.SOURCE.LOCAL && this.localPlayer) {
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
    if (this.activeSource === CONSTANTS.PLAYER.SOURCE.LOCAL && this.localPlayer) {
      return this.localPlayer.volume * 100;
    }
    return this.api?.getVolume() || 0;
  }

  setVolume(volume) {
    if (this.activeSource === CONSTANTS.PLAYER.SOURCE.LOCAL && this.localPlayer) {
      this.localPlayer.volume = volume / 100;
    }
    this.api?.setVolume(volume);
  }

  isMuted() {
    if (this.activeSource === CONSTANTS.PLAYER.SOURCE.LOCAL && this.localPlayer) {
      return this.localPlayer.muted;
    }
    return this.api?.isMuted() || false;
  }

  mute() {
    if (this.localPlayer) this.localPlayer.muted = true;
    this.api?.mute();
  }

  unMute() {
    if (this.localPlayer) this.localPlayer.muted = false;
    this.api?.unMute();
  }

  getCurrentTime() {
    if (this.activeSource === CONSTANTS.PLAYER.SOURCE.LOCAL && this.localPlayer) {
      return this.localPlayer.currentTime;
    }
    return this.api?.getCurrentTime() || 0;
  }

  getDuration() {
    if (this.activeSource === CONSTANTS.PLAYER.SOURCE.LOCAL && this.localPlayer) {
      return this.localPlayer.duration || 0;
    }
    return this.api?.getDuration() || 0;
  }

  /**
   * Gets the current state of the player
   * @returns {number} Value from CONSTANTS.PLAYER.STATE
   */
  getPlayerState() {
    if (this.activeSource === CONSTANTS.PLAYER.SOURCE.LOCAL && this.localPlayer) {
      if (this.localPlayer.ended) return CONSTANTS.PLAYER.STATE.ENDED;
      return this.localPlayer.paused ? CONSTANTS.PLAYER.STATE.PAUSED : CONSTANTS.PLAYER.STATE.PLAYING;
    }
    return this.api?.getPlayerState() ?? CONSTANTS.PLAYER.STATE.UNSTARTED;
  }

  /**
   * Checks if a local file is currently playing
   * @param {File} file 
   * @returns {boolean}
   */
  isLocalFilePlaying(file) {
    return this.activeSource === CONSTANTS.PLAYER.SOURCE.LOCAL && 
           this.localPlayer && 
           !this.localPlayer.paused && 
           this.currentLocalFile === file;
  }
}
