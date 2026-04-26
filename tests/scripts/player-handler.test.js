import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlayerHandler } from '../../scripts/player-handler.js';
import { CONSTANTS } from '../../utils/constants.js';

describe('PlayerHandler', () => {
  let handler;

  beforeEach(() => {
    vi.useFakeTimers();
    // Clean up document body
    document.body.innerHTML = '';
    handler = new PlayerHandler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should initialize successfully when playerApi is available', () => {
    const mockApi = { playVideo: vi.fn() };
    const mockApp = document.createElement('ytmusic-app');
    mockApp.playerApi = mockApi;
    document.body.appendChild(mockApp);

    handler.init();
    expect(handler.initialized).toBe(true);
    expect(handler.api).toBe(mockApi);
  });

  it('should retry initialization if playerApi is not immediately available', () => {
    handler.init();
    expect(handler.initialized).toBe(false);
    expect(handler.retryCount).toBe(1);

    // Add mock app after first try
    const mockApi = { playVideo: vi.fn() };
    const mockApp = document.createElement('ytmusic-app');
    mockApp.playerApi = mockApi;
    document.body.appendChild(mockApp);

    vi.advanceTimersByTime(1000);
    expect(handler.initialized).toBe(true);
    expect(handler.retryCount).toBe(0);
  });

  it('should stop retrying after maxRetries', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    handler.init();
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(1000);
    }

    expect(handler.initialized).toBe(false);
    expect(handler.retryCount).toBe(10);
    expect(consoleSpy).toHaveBeenCalledWith('PlayerHandler: Failed to initialize after max retries.');
  });

  it('should call playVideo when playTrack is called with current videoId', () => {
    const mockApi = { 
      getVideoData: vi.fn().mockReturnValue({ video_id: 'vid123' }),
      playVideo: vi.fn(),
      loadVideoById: vi.fn()
    };
    const mockApp = document.createElement('ytmusic-app');
    mockApp.playerApi = mockApi;
    document.body.appendChild(mockApp);

    handler.playTrack('vid123');
    expect(mockApi.playVideo).toHaveBeenCalled();
    expect(mockApi.loadVideoById).not.toHaveBeenCalled();
  });

  it('should call loadVideoById when playTrack is called with different videoId', () => {
    const mockApi = { 
      getVideoData: vi.fn().mockReturnValue({ video_id: 'other123' }),
      playVideo: vi.fn(),
      loadVideoById: vi.fn()
    };
    const mockApp = document.createElement('ytmusic-app');
    mockApp.playerApi = mockApi;
    document.body.appendChild(mockApp);

    handler.playTrack('vid123');
    expect(mockApi.loadVideoById).toHaveBeenCalledWith('vid123');
  });

  it('should call pauseVideo', () => {
    const mockApi = { pauseVideo: vi.fn() };
    const mockApp = document.createElement('ytmusic-app');
    mockApp.playerApi = mockApi;
    document.body.appendChild(mockApp);

    handler.pauseTrack();
    expect(mockApi.pauseVideo).toHaveBeenCalled();
  });

  it('should call seekBy', () => {
    const mockApi = { seekBy: vi.fn() };
    const mockApp = document.createElement('ytmusic-app');
    mockApp.playerApi = mockApi;
    document.body.appendChild(mockApp);

    handler.seekBy(10);
    expect(mockApi.seekBy).toHaveBeenCalledWith(10);
  });

  it('should return video data', () => {
    const videoData = { video_id: 'vid123', author: 'Artist', title: 'Song' };
    const mockApi = { getVideoData: vi.fn().mockReturnValue(videoData) };
    const mockApp = document.createElement('ytmusic-app');
    mockApp.playerApi = mockApi;
    document.body.appendChild(mockApp);

    expect(handler.getVideoData()).toEqual(videoData);
  });

  it('should call nextVideo', () => {
    const mockApi = { nextVideo: vi.fn() };
    const mockApp = document.createElement('ytmusic-app');
    mockApp.playerApi = mockApi;
    document.body.appendChild(mockApp);

    handler.nextTrack();
    expect(mockApi.nextVideo).toHaveBeenCalled();
  });

  it('should call previousVideo', () => {
    const mockApi = { previousVideo: vi.fn() };
    const mockApp = document.createElement('ytmusic-app');
    mockApp.playerApi = mockApi;
    document.body.appendChild(mockApp);

    handler.previousTrack();
    expect(mockApi.previousVideo).toHaveBeenCalled();
  });

  it('should get and set volume', () => {
    const mockApi = { 
      getVolume: vi.fn().mockReturnValue(50),
      setVolume: vi.fn()
    };
    const mockApp = document.createElement('ytmusic-app');
    mockApp.playerApi = mockApi;
    document.body.appendChild(mockApp);

    expect(handler.getVolume()).toBe(50);
    handler.setVolume(80);
    expect(mockApi.setVolume).toHaveBeenCalledWith(80);
  });

  it('should handle muting', () => {
    const mockApi = { 
      isMuted: vi.fn().mockReturnValue(false),
      mute: vi.fn(),
      unMute: vi.fn()
    };
    const mockApp = document.createElement('ytmusic-app');
    mockApp.playerApi = mockApi;
    document.body.appendChild(mockApp);

    expect(handler.isMuted()).toBe(false);
    handler.mute();
    expect(mockApi.mute).toHaveBeenCalled();
    handler.unMute();
    expect(mockApi.unMute).toHaveBeenCalled();
  });

  it('should get current time and duration', () => {
    const mockApi = { 
      getCurrentTime: vi.fn().mockReturnValue(120),
      getDuration: vi.fn().mockReturnValue(300)
    };
    const mockApp = document.createElement('ytmusic-app');
    mockApp.playerApi = mockApi;
    document.body.appendChild(mockApp);

    expect(handler.getCurrentTime()).toBe(120);
    expect(handler.getDuration()).toBe(300);
  });

  it('should return player state', () => {
    const mockApi = { getPlayerState: vi.fn().mockReturnValue(CONSTANTS.PLAYER.STATE.PLAYING) };
    const mockApp = document.createElement('ytmusic-app');
    mockApp.playerApi = mockApi;
    document.body.appendChild(mockApp);

    expect(handler.getPlayerState()).toBe(CONSTANTS.PLAYER.STATE.PLAYING);
  });

  describe('Local playback', () => {
    it('should play local file and pause YouTube player', () => {
      const mockApi = { pauseVideo: vi.fn() };
      const mockApp = document.createElement('ytmusic-app');
      mockApp.playerApi = mockApi;
      document.body.appendChild(mockApp);

      const mockFile = new File([''], 'test.mp3', { type: 'audio/mpeg' });
      
      // Mock Audio play and paused property
      const playSpy = vi.spyOn(Audio.prototype, 'play').mockImplementation(function() {
        vi.spyOn(this, 'paused', 'get').mockReturnValue(false);
        return Promise.resolve();
      });
      
      handler.playLocalFile(mockFile);

      expect(mockApi.pauseVideo).toHaveBeenCalled();
      expect(playSpy).toHaveBeenCalled();
      expect(handler.isLocalFilePlaying(mockFile)).toBe(true);
    });

    it('should handle local playback failure', async () => {
      const mockFile = new File([''], 'test.mp3', { type: 'audio/mpeg' });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      vi.spyOn(Audio.prototype, 'play').mockRejectedValue(new Error('Playback failed'));
      
      handler.playLocalFile(mockFile);
      
      // Wait for promise rejection to be handled
      await vi.runAllTimersAsync();
      
      expect(consoleSpy).toHaveBeenCalledWith('PlayerHandler: Local playback failed', expect.any(Error));
      expect(handler.activeSource).toBe(CONSTANTS.PLAYER.SOURCE.YOUTUBE);
    });

    it('should pause local playback', () => {
      const mockFile = new File([''], 'test.mp3', { type: 'audio/mpeg' });
      const pauseSpy = vi.spyOn(Audio.prototype, 'pause').mockImplementation(() => {});
      
      // Simulate playing
      handler.localPlayer = new Audio();
      handler.currentLocalFile = mockFile;
      handler.activeSource = CONSTANTS.PLAYER.SOURCE.LOCAL;
      vi.spyOn(handler.localPlayer, 'paused', 'get').mockReturnValue(false);

      handler.pauseLocalTrack();
      expect(pauseSpy).toHaveBeenCalled();
    });

    it('should seek local playback', () => {
      const mockFile = new File([''], 'test.mp3', { type: 'audio/mpeg' });
      handler.localPlayer = new Audio();
      handler.currentLocalFile = mockFile;
      handler.activeSource = CONSTANTS.PLAYER.SOURCE.LOCAL;
      vi.spyOn(handler.localPlayer, 'paused', 'get').mockReturnValue(false);
      handler.localPlayer.currentTime = 10;

      handler.seekBy(5);
      expect(handler.localPlayer.currentTime).toBe(15);
    });
  });
});
