import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlayerHandler } from '../../scripts/player-handler.js';

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
});
