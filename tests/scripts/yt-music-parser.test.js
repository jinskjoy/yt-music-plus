import { describe, it, expect, vi } from 'vitest';
import { YTMusicParser } from '../../scripts/yt-music-parser.js';
import { Playlist } from '../../scripts/models/playlist.js';
import { Track } from '../../scripts/models/track.js';

describe('YTMusicParser Extended', () => {
  describe('parsePlaylistsFromResponse', () => {
    it('should return empty array if data is null', () => {
      expect(YTMusicParser.parsePlaylistsFromResponse(null)).toEqual([]);
    });

    it('should find renderer in nested objects', () => {
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
                          somethingElse: {
                            musicTwoRowItemRenderer: {
                              title: { runs: [{ text: 'Nested Playlist' }] },
                              navigationEndpoint: { browseEndpoint: { browseId: 'VLPL123' } },
                              menu: { menuRenderer: { items: [] } }
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
      
      const playlists = YTMusicParser.parsePlaylistsFromResponse(mockData);
      expect(playlists).toHaveLength(1);
      expect(playlists[0].title).toBe('Nested Playlist');
    });

    it('should handle musicShelfRenderer and carouselShelfRenderer', () => {
       const mockData = {
        contents: {
          singleColumnBrowseResultsRenderer: {
            tabs: [{
              tabRenderer: {
                content: {
                  sectionListRenderer: {
                    contents: [
                      {
                        musicShelfRenderer: {
                          contents: [{
                            musicTwoRowItemRenderer: {
                              title: { runs: [{ text: 'Shelf Playlist' }] },
                              navigationEndpoint: { browseEndpoint: { browseId: 'VLPL_SHELF' } },
                              menu: { menuRenderer: { items: [] } }
                            }
                          }]
                        }
                      },
                      {
                        carouselShelfRenderer: {
                          contents: [{
                            musicTwoRowItemRenderer: {
                              title: { runs: [{ text: 'Carousel Playlist' }] },
                              navigationEndpoint: { browseEndpoint: { browseId: 'VLPL_CAROUSEL' } },
                              menu: { menuRenderer: { items: [] } }
                            }
                          }]
                        }
                      }
                    ]
                  }
                }
              }
            }]
          }
        }
      };

      const playlists = YTMusicParser.parsePlaylistsFromResponse(mockData);
      expect(playlists).toHaveLength(2);
      expect(playlists[0].title).toBe('Shelf Playlist');
      expect(playlists[1].title).toBe('Carousel Playlist');
    });
  });

  describe('extractPlaylistFromMusicTwoRowRenderer', () => {
    it('should return null if no title', () => {
      const renderer = {
        title: null,
        menu: { menuRenderer: { items: [] } }
      };
      expect(YTMusicParser.extractPlaylistFromMusicTwoRowRenderer(renderer)).toBeNull();
    });

    it('should strip VL prefix from ID', () => {
      const renderer = {
        title: { simpleText: 'Title' },
        navigationEndpoint: { browseEndpoint: { browseId: 'VLPL123' } },
        menu: { menuRenderer: { items: [] } }
      };
      const p = YTMusicParser.extractPlaylistFromMusicTwoRowRenderer(renderer);
      expect(p.id).toBe('PL123');
    });

    it('should use watchPlaylistEndpoint as fallback ID', () => {
      const renderer = {
        title: { simpleText: 'Title' },
        navigationEndpoint: { watchPlaylistEndpoint: { playlistId: 'PL456' } },
        menu: { menuRenderer: { items: [] } }
      };
      const p = YTMusicParser.extractPlaylistFromMusicTwoRowRenderer(renderer);
      expect(p.id).toBe('PL456');
    });
  });

  describe('getBestSearchResult', () => {
    it('should return null if no searchIdentifier found', () => {
      const response = {
        contents: {
          tabbedSearchResultsRenderer: {
            tabs: [{ tabRenderer: { tabIdentifier: 'wrong', content: {} } }]
          }
        }
      };
      expect(YTMusicParser.getBestSearchResult(response, { name: 'test' })).toBeNull();
    });

    it('should parse from musicCardShelfRenderer', () => {
      const response = {
        contents: {
          tabbedSearchResultsRenderer: {
            tabs: [{
              tabRenderer: {
                tabIdentifier: 'music_search_catalog',
                content: {
                  sectionListRenderer: {
                    contents: [{
                      musicCardShelfRenderer: {
                        title: { runs: [{ text: 'Best Match', navigationEndpoint: { watchEndpoint: { videoId: 'v1' } } }] },
                        subtitle: { runs: [{ text: 'Song' }, { text: ' • ' }, { text: 'Artist' }] },
                        thumbnail: { musicThumbnailRenderer: { thumbnail: { thumbnails: [{ url: 't1' }] } } }
                      }
                    }]
                  }
                }
              }
            }]
          }
        }
      };
      
      const result = YTMusicParser.getBestSearchResult(response, { name: 'Best Match' });
      expect(result).not.toBeNull();
      expect(result.name).toBe('Best Match');
      expect(result.videoId).toBe('v1');
    });

    it('should parse from musicShelfRenderer and return highest match score', () => {
       const response = {
        contents: {
          tabbedSearchResultsRenderer: {
            tabs: [{
              tabRenderer: {
                tabIdentifier: 'music_search_catalog',
                content: {
                  sectionListRenderer: {
                    contents: [{
                      musicShelfRenderer: {
                        contents: [
                          {
                            musicResponsiveListItemRenderer: {
                              flexColumns: [
                                { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: 'Close Match' }] } } },
                                { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: 'Song' }] } } }
                              ],
                              playlistItemData: { videoId: 'v1' }
                            }
                          },
                          {
                            musicResponsiveListItemRenderer: {
                              flexColumns: [
                                { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: 'Perfect Match' }] } } },
                                { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: 'Song' }] } } }
                              ],
                              playlistItemData: { videoId: 'v2' }
                            }
                          }
                        ]
                      }
                    }]
                  }
                }
              }
            }]
          }
        }
      };

      const result = YTMusicParser.getBestSearchResult(response, { name: 'Perfect Match' });
      expect(result.name).toBe('Perfect Match');
      expect(result.videoId).toBe('v2');
    });
  });

  describe('parseCardResult', () => {
    it('should return null if not a music item', () => {
      const card = { subtitle: { runs: [{ text: 'Artist' }] } };
      expect(YTMusicParser.parseCardResult(card, 'title')).toBeNull();
    });
    
    it('should extract videoId from buttons if title endpoint missing', () => {
       const card = {
        title: { runs: [{ text: 'Match' }] },
        subtitle: { runs: [{ text: 'Song' }] },
        buttons: [{ buttonRenderer: { command: { watchEndpoint: { videoId: 'v_from_btn' } } } }]
      };
      const result = YTMusicParser.parseCardResult(card, 'Match');
      expect(result.videoId).toBe('v_from_btn');
    });
  });

  describe('parseTextField', () => {
    it('should handle various field formats', () => {
      expect(YTMusicParser.parseTextField(null)).toBe('');
      expect(YTMusicParser.parseTextField('string')).toBe('string');
      expect(YTMusicParser.parseTextField({ simpleText: 'simple' })).toBe('simple');
      expect(YTMusicParser.parseTextField({ runs: [{ text: 'part1' }, { text: 'part2' }] })).toBe('part1part2');
      expect(YTMusicParser.parseTextField({ other: 'value' })).toBe('');
    });
  });

  describe('findRenderer', () => {
    it('should return null for non-objects', () => {
      expect(YTMusicParser.findRenderer(null, 'key')).toBeNull();
      expect(YTMusicParser.findRenderer('string', 'key')).toBeNull();
      expect(YTMusicParser.findRenderer(123, 'key')).toBeNull();
    });
  });

  describe('isPlaylistEditable', () => {
    it('should return false for invalid input', () => {
      expect(YTMusicParser.isPlaylistEditable(null)).toBe(false);
      expect(YTMusicParser.isPlaylistEditable({})).toBe(false);
    });

    it('should return true if edit keywords found', () => {
      const menuItems = [
        {
          menuNavigationItemRenderer: {
            text: { runs: [{ text: 'Edit playlist' }] }
          }
        }
      ];
      expect(YTMusicParser.isPlaylistEditable(menuItems)).toBe(true);
    });

    it('should return true if playlistEditorEndpoint found', () => {
      const menuItems = [
        {
          menuServiceItemRenderer: {
            serviceEndpoint: { playlistEditorEndpoint: {} }
          }
        }
      ];
      expect(YTMusicParser.isPlaylistEditable(menuItems)).toBe(true);
    });

    it('should return false if no edit markers found', () => {
      const menuItems = [
        {
          menuNavigationItemRenderer: {
            text: { runs: [{ text: 'Share' }] }
          }
        }
      ];
      expect(YTMusicParser.isPlaylistEditable(menuItems)).toBe(false);
    });
  });

  describe('parsePlaylistItemsFromResponse', () => {
    it('should return empty array if no input', () => {
      expect(YTMusicParser.parsePlaylistItemsFromResponse(null)).toEqual([]);
    });

    it('should parse tracks with greyed out and video status', () => {
      const itemRenderers = [
        {
          musicResponsiveListItemRenderer: {
            flexColumns: [
              { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: 'Song 1' }] } } },
              { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: 'Artist 1' }] } } }
            ],
            musicItemRendererDisplayPolicy: 'MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT',
            overlay: {
              musicItemThumbnailOverlayRenderer: {
                content: {
                  musicPlayButtonRenderer: {
                    playNavigationEndpoint: {
                      watchEndpoint: {
                        watchEndpointMusicSupportedConfigs: {
                          watchEndpointMusicConfig: { musicVideoType: 'MUSIC_VIDEO_TYPE_UGC' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      ];
      const tracks = YTMusicParser.parsePlaylistItemsFromResponse(itemRenderers);
      expect(tracks).toHaveLength(1);
      expect(tracks[0].isGreyedOut).toBe(true);
      expect(tracks[0].isVideo).toBe(true);
    });
  });

  describe('parseShelfResults', () => {
    it('should ignore non-song/video items', () => {
      const shelf = {
        contents: [
          {
            musicResponsiveListItemRenderer: {
              flexColumns: [
                { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: 'Artist Name' }] } } },
                { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: 'Artist' }] } } }
              ]
            }
          }
        ]
      };
      expect(YTMusicParser.parseShelfResults(shelf, 'title', 0.8)).toBeNull();
    });

    it('should return null if shelf is empty', () => {
      expect(YTMusicParser.parseShelfResults(null, 'title', 0.8)).toBeNull();
      expect(YTMusicParser.parseShelfResults({ contents: [] }, 'title', 0.8)).toBeNull();
    });
  });

  describe('getPlaylistInfoFromMenuItems', () => {
    it('should extract ID from various endpoints', () => {
      const testCases = [
        { key: 'playlistEditEndpoint', id: 'id1' },
        { key: 'addToPlaylistEndpoint', id: 'id2' },
        { key: 'queueAddEndpoint', id: 'id3', wrap: (id) => ({ queueTarget: { playlistId: id } }) },
        { key: 'likeEndpoint', id: 'id4', wrap: (id) => ({ target: { playlistId: id } }) }
      ];

      testCases.forEach(tc => {
        const endpoint = {};
        endpoint[tc.key] = tc.wrap ? tc.wrap(tc.id) : { playlistId: tc.id };
        const menuItems = [{ menuNavigationItemRenderer: { navigationEndpoint: endpoint } }];
        const info = YTMusicParser.getPlaylistInfoFromMenuItems(menuItems);
        expect(info.id).toBe(tc.id);
      });
    });
  });
});
