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
  /**
   * Centralized getter for the player API
   * @returns {Object|null}
   */
  get api() {
    const app = document.querySelector('ytmusic-app');
    if (app?.playerApi && typeof app.playerApi.loadVideoById === 'function') {
      return app.playerApi;
    }
    const moviePlayer = document.getElementById('movie_player');
    if (moviePlayer && typeof moviePlayer.loadVideoById === 'function') {
      return moviePlayer;
    }
    const playerBar = document.querySelector('ytmusic-player-bar');
    if (playerBar?.playerApi && typeof playerBar.playerApi.loadVideoById === 'function') {
      return playerBar.playerApi;
    }
    if (playerBar && typeof playerBar.loadVideoById === 'function') {
      return playerBar;
    }
    return app?.playerApi || moviePlayer || null;
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
  playTrack(videoId, trackInfo = null) {
    if (!videoId) return;

    // Stop local player if running
    this.pauseLocalTrack();
    this.activeSource = CONSTANTS.PLAYER.SOURCE.YOUTUBE;

    const playerApi = this.api;
    if (playerApi) {
      // Check if it's already the current video
      const currentVideoData = playerApi.getVideoData?.();
      const currentVideoId = currentVideoData?.video_id || currentVideoData?.videoId;
      if (currentVideoId === videoId) {
        if (typeof playerApi.playVideo === 'function') {
          playerApi.playVideo();
        }
      } else {
        if (typeof playerApi.loadVideoById === 'function') {
          try {
            playerApi.loadVideoById(videoId);
          } catch (error) {
            try {
              playerApi.loadVideoById({ videoId });
            } catch (innerError) {
              console.error('PlayerHandler: Failed to load video by ID', innerError);
            }
          }
        }
      }
    }

    // Immediately update player bar elements (thumbnail, title, artist)
    this.updatePlayerBar(videoId, trackInfo);

    // Schedule a delayed update to catch metadata returned by YouTube API after video loads
    setTimeout(() => {
      this.updatePlayerBar(videoId, trackInfo);
    }, CONSTANTS.UI.UI_UPDATE_DELAY_MS);
  }

  playLocalFile(file) {
    if (!file) return;

    // Pause YouTube player
    this.pauseTrack();
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

    this.updatePlayerBar(null, { name: file.name, artist: 'Local Audio File' });
  }

  /**
   * Ensures the bottom player bar is visible if it was hidden
   */
  showPlayerBar() {
    const playerBar = document.querySelector('ytmusic-player-bar');
    if (!playerBar) return;

    playerBar.removeAttribute('hidden');
    playerBar.hidden = false;
    playerBar.classList.remove('hidden', 'yt-music-plus-hidden');

    if (playerBar.style.display === 'none') {
      playerBar.style.display = '';
    }
    if (playerBar.style.visibility === 'hidden') {
      playerBar.style.visibility = 'visible';
    }

    let parent = playerBar.parentElement;
    while (parent && parent.tagName !== 'BODY') {
      if (parent.hasAttribute('hidden')) {
        parent.removeAttribute('hidden');
      }
      if (parent.hidden) {
        parent.hidden = false;
      }
      if (parent.classList.contains('hidden')) {
        parent.classList.remove('hidden');
      }
      if (parent.style.display === 'none') {
        parent.style.display = '';
      }
      parent = parent.parentElement;
    }
  }

  /**
   * Updates the YouTube Music bottom player bar (ytmusic-player-bar) thumbnail, title, and artist
   * @param {string|null} videoId 
   * @param {Object|null} [trackInfo=null] 
   */
  updatePlayerBar(videoId, trackInfo = null) {
    const playerBar = document.querySelector('ytmusic-player-bar');
    if (!playerBar) return;

    this.showPlayerBar();

    // Retrieve video data from API if trackInfo is missing or incomplete
    const videoData = this.getVideoData() || {};
    const titleText = trackInfo?.name || trackInfo?.title || videoData.title;
    const artistText = trackInfo?.artist || videoData.author;
    const thumbnailUrl = trackInfo?.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null);

    // 1. Update Thumbnail
    if (thumbnailUrl) {
      const thumbImgs = playerBar.querySelectorAll('.thumbnail-image-wrapper img, #thumbnail img, img.image, .image, img#img');
      thumbImgs.forEach(img => {
        if (img.src !== thumbnailUrl) {
          img.src = thumbnailUrl;
        }
      });
    }

    // 2. Update Title
    if (titleText) {
      const titleEls = playerBar.querySelectorAll('.title, yt-formatted-string.title, .content-info-wrapper .title');
      titleEls.forEach(titleEl => {
        const childLink = titleEl.querySelector('a');
        if (childLink) {
          childLink.textContent = titleText;
          childLink.title = titleText;
          if (videoId) {
            childLink.href = `watch?v=${videoId}`;
          }
        } else {
          titleEl.textContent = titleText;
        }
        titleEl.title = titleText;
      });
    }

    // 3. Update Artist / Byline
    if (artistText) {
      const bylineEls = playerBar.querySelectorAll('.byline, yt-formatted-string.byline, .content-info-wrapper .byline');
      bylineEls.forEach(bylineEl => {
        const childLink = bylineEl.querySelector('a');
        if (childLink) {
          childLink.textContent = artistText;
          childLink.title = artistText;
        } else {
          bylineEl.textContent = artistText;
        }
        bylineEl.title = artistText;
      });
    }

    // 4. Update Polymer / Custom Element properties if present
    try {
      if ('currentVideoData' in playerBar || 'videoData' in playerBar) {
        const dataObj = {
          title: titleText,
          author: artistText,
          videoId: videoId
        };
        if (playerBar.currentVideoData) Object.assign(playerBar.currentVideoData, dataObj);
        if (playerBar.videoData) Object.assign(playerBar.videoData, dataObj);
      }
    } catch (e) {
      // Ignore polymer mutation errors silently
    }
  }

  pauseTrack() {
    if (typeof this.api?.pauseVideo === 'function') {
      this.api.pauseVideo();
    }
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
      const api = this.api;
      if (!api) return;
      if (typeof api.seekBy === 'function') {
        api.seekBy(seconds);
      } else if (typeof api.seekTo === 'function' && typeof api.getCurrentTime === 'function') {
        const currentTime = api.getCurrentTime() || 0;
        api.seekTo(currentTime + seconds, true);
      }
    }
  }

  /**
   * Additional player methods
   */
  getVideoData() {
    return this.api?.getVideoData?.() || null;
  }

  nextTrack() {
    if (typeof this.api?.nextVideo === 'function') {
      this.api.nextVideo();
    }
  }

  previousTrack() {
    if (typeof this.api?.previousVideo === 'function') {
      this.api.previousVideo();
    }
  }

  getVolume() {
    if (this.activeSource === CONSTANTS.PLAYER.SOURCE.LOCAL && this.localPlayer) {
      return this.localPlayer.volume * 100;
    }
    return this.api?.getVolume?.() || 0;
  }

  setVolume(volume) {
    if (this.activeSource === CONSTANTS.PLAYER.SOURCE.LOCAL && this.localPlayer) {
      this.localPlayer.volume = volume / 100;
    }
    if (typeof this.api?.setVolume === 'function') {
      this.api.setVolume(volume);
    }
  }

  isMuted() {
    if (this.activeSource === CONSTANTS.PLAYER.SOURCE.LOCAL && this.localPlayer) {
      return this.localPlayer.muted;
    }
    return this.api?.isMuted?.() || false;
  }

  mute() {
    if (this.localPlayer) this.localPlayer.muted = true;
    if (typeof this.api?.mute === 'function') {
      this.api.mute();
    }
  }

  unMute() {
    if (this.localPlayer) this.localPlayer.muted = false;
    if (typeof this.api?.unMute === 'function') {
      this.api.unMute();
    }
  }

  getCurrentTime() {
    if (this.activeSource === CONSTANTS.PLAYER.SOURCE.LOCAL && this.localPlayer) {
      return this.localPlayer.currentTime;
    }
    return this.api?.getCurrentTime?.() || 0;
  }

  getDuration() {
    if (this.activeSource === CONSTANTS.PLAYER.SOURCE.LOCAL && this.localPlayer) {
      return this.localPlayer.duration || 0;
    }
    return this.api?.getDuration?.() || 0;
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
    return this.api?.getPlayerState?.() ?? CONSTANTS.PLAYER.STATE.UNSTARTED;
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
