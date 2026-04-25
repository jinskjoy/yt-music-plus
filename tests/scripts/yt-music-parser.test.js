import { describe, it, expect } from 'vitest';
import { YTMusicParser } from '../../scripts/yt-music-parser.js';

describe('YTMusicParser', () => {
  describe('parseEditablePlaylistsFromResponse', () => {
    it('should parse playlists correctly', () => {
      const mockData = {
        contents: {
          singleColumnBrowseResultsRenderer: {
            tabs: [{
              tabRenderer: {
                content: {
                  sectionListRenderer: {
                    contents: [{
                      gridRenderer: {
                        items: [{
                          musicTwoRowItemRenderer: {
                            title: { runs: [{ text: 'Playlist Title' }] },
                            subtitle: { runs: [{ text: 'Owner' }] },
                            menu: {
                              menuRenderer: {
                                items: [{
                                  menuNavigationItemRenderer: {
                                    navigationEndpoint: {
                                      playlistEditorEndpoint: { playlistId: 'PL123' }
                                    }
                                  }
                                }]
                              }
                            },
                            thumbnailRenderer: {
                              musicThumbnailRenderer: {
                                thumbnail: {
                                  thumbnails: [{ url: 'thumb-url' }]
                                }
                              }
                            }
                          }
                        }]
                      }
                    }]
                  }
                }
              }
            }]
          }
        }
      };

      const playlists = YTMusicParser.parseEditablePlaylistsFromResponse(mockData);
      expect(playlists).toHaveLength(1);
      expect(playlists[0]).toEqual({
        id: 'PL123',
        title: 'Playlist Title',
        subtitle: 'Owner',
        owner: 'Owner',
        thumbnail: 'thumb-url'
      });
    });
  });

  describe('parsePlaylistItemsFromResponse', () => {
    it('should parse playlist items correctly', () => {
      const mockItems = [{
        musicResponsiveListItemRenderer: {
          flexColumns: [
            {
              musicResponsiveListItemFlexColumnRenderer: {
                text: { runs: [{ text: 'Song Name' }] }
              }
            },
            {
              musicResponsiveListItemFlexColumnRenderer: {
                text: { runs: [{ text: 'Artist Name' }] }
              }
            },
            {
              musicResponsiveListItemFlexColumnRenderer: {
                text: { runs: [{ text: 'Album Name' }] }
              }
            }
          ],
          fixedColumns: [{
            musicResponsiveListItemFixedColumnRenderer: {
              text: { runs: [{ text: '3:45' }] }
            }
          }],
          playlistItemData: {
            videoId: 'vid123',
            playlistSetVideoId: 'set123'
          }
        }
      }];

      const items = YTMusicParser.parsePlaylistItemsFromResponse(mockItems);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        name: 'Song Name',
        artists: ['Artist Name'],
        album: 'Album Name',
        duration: '3:45',
        videoId: 'vid123',
        playlistSetVideoId: 'set123'
      });
    });
  });

  describe('parseTextField', () => {
    it('should handle string', () => {
      expect(YTMusicParser.parseTextField('test')).toBe('test');
    });

    it('should handle simpleText', () => {
      expect(YTMusicParser.parseTextField({ simpleText: 'test' })).toBe('test');
    });

    it('should handle runs', () => {
      expect(YTMusicParser.parseTextField({ runs: [{ text: 'a' }, { text: 'b' }] })).toBe('ab');
    });
  });
});
