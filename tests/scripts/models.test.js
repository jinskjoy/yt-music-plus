import { describe, it, expect } from 'vitest';
import { Track } from '../../scripts/models/track.js';
import { Playlist } from '../../scripts/models/playlist.js';

describe('Playlist Class', () => {
  it('should create a Playlist instance correctly', () => {
    const playlist = new Playlist({
      id: 'PL123',
      title: 'My Playlist',
      subtitle: '10 songs',
      owner: 'User',
      thumbnail: 'url'
    });

    expect(playlist.id).toBe('PL123');
    expect(playlist.title).toBe('My Playlist');
    expect(playlist.subtitle).toBe('10 songs');
    expect(playlist.owner).toBe('User');
    expect(playlist.thumbnail).toBe('url');
  });

  it('should create from JSON', () => {
    const data = { id: 'PL123', title: 'Test' };
    const playlist = Playlist.fromJSON(data);
    expect(playlist).toBeInstanceOf(Playlist);
    expect(playlist.id).toBe('PL123');
  });
});

describe('Track Class', () => {
  it('should create a Track instance correctly', () => {
    const track = new Track({
      name: 'Song',
      artists: ['Artist 1', 'Artist 2'],
      album: 'Album',
      duration: '3:00'
    });

    expect(track.name).toBe('Song');
    expect(track.artists).toEqual(['Artist 1', 'Artist 2']);
    expect(track.artistsString).toBe('Artist 1, Artist 2');
    expect(track.toSearchQuery()).toBe('Song - Album - Artist 1, Artist 2');
  });

  it('should handle local file correctly', () => {
    const mockFile = { name: 'test.mp3' };
    const track = new Track({
      name: 'Local Song',
      isLocal: true,
      localFile: mockFile
    });

    expect(track.isLocal).toBe(true);
    expect(track.localFile).toBe(mockFile);
  });

  it('should handle replacement as a Track instance', () => {
    const replacementData = { name: 'Replacement' };
    const track = new Track({
      name: 'Original',
      replacement: replacementData
    });

    expect(track.replacement).toBeInstanceOf(Track);
    expect(track.replacement.name).toBe('Replacement');
  });

  it('should check match correctly', () => {
    const track = new Track({ name: 'Shake It Off' });
    expect(track.updateMatchStatus('Shake It Off')).toBe(true);
    expect(track.isGoodMatch).toBe(true);
    
    expect(track.updateMatchStatus('completely different song name')).toBe(false);
    expect(track.isGoodMatch).toBe(false);
  });
});
