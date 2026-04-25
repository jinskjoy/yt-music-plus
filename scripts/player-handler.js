/**
 * PlayerHandler - Handles playback controls within the YouTube Music UI
 * Provides play, pause, and seek functionality for each track
 */
export class PlayerHandler {
  constructor() {
    this.app = document.querySelector('ytmusic-app');
    this.playerApi = this.app?.playerApi;
    this.initialized = false;
  }

  /**
   * Initializes the PlayerHandler
   */
  init() {
    if (this.initialized) return;
    
    this.app = document.querySelector('ytmusic-app');
    this.playerApi = this.app?.playerApi;
    
    if (!this.playerApi) {
      // Retry after a short delay if playerApi is not yet available
      setTimeout(() => this.init(), 1000);
      return;
    }

    this.initialized = true;
  }

  /**
   * Playback actions
   */
  playTrack(videoId) {
    if (!this.playerApi) {
      this.app = document.querySelector('ytmusic-app');
      this.playerApi = this.app?.playerApi;
    }
    
    if (!this.playerApi) return;
    
    // Check if it's already the current video
    const currentVideoId = this.playerApi.getVideoData()?.video_id;
    if (currentVideoId === videoId) {
      this.playerApi.playVideo();
    } else {
      this.playerApi.loadVideoById(videoId);
    }
  }

  pauseTrack() {
    this.playerApi?.pauseVideo();
  }

  seekBy(seconds) {
    this.playerApi?.seekBy(seconds);
  }
}
