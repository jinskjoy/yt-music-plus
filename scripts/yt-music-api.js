import { UIHelper } from "../utils/ui-helper.js";
export class YTMusicAPI {
    constructor() {
        this.baseURL = 'https://music.youtube.com';
        this.authToken = null;
    }
    isAuthTokenSet() {
        return !!this.authToken;
    }

    async makeGetRequest(endpoint, params = {}) {
        const url = new URL(this.baseURL + endpoint);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': this.authToken || '' // Include auth token if available
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }
    async makePostRequest(endpoint, body = {}) {
        const url = this.baseURL + endpoint;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'accept': '*/*',
                'Authorization': this.authToken || '', // Include auth token if available
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    setAuthToken(token) {
        this.authToken = token;
    }

    async getEditablePlaylists() {
        const playlists = [];
        try {
            const response = await this.makePostRequest("/youtubei/v1/browse?prettyPrint=false", {
                context: window.ytcfg.data_.INNERTUBE_CONTEXT,
                browseId: "FEmusic_liked_playlists"
            });
            return this.parseEditablePlaylistsFromResponse(response);
        } catch (error) {
            console.error('Error fetching editable playlists:', error);
            throw error;
        }
    }

    parseEditablePlaylistsFromResponse(data) {
        let playlists = [];
        try {
            // Navigate to the main content grid
            const items = data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.gridRenderer?.items || [];

            items.forEach((item) => {
                const renderer = item?.musicTwoRowItemRenderer;
                if (!renderer) return;

                // Check if this playlist has edit permissions
                const menu = renderer?.menu?.menuRenderer?.items || [];
                const hasEditPermission = menu.some((menuItem) => {
                    return menuItem?.menuNavigationItemRenderer?.navigationEndpoint?.playlistEditorEndpoint?.playlistId;
                });

                if (!hasEditPermission) return;

                // Extract playlist information from the first menu item with playlistEditorEndpoint
                let playlistId = null;
                menu.forEach((menuItem) => {
                    if (menuItem?.menuNavigationItemRenderer?.navigationEndpoint?.playlistEditorEndpoint?.playlistId) {
                        playlistId = menuItem.menuNavigationItemRenderer.navigationEndpoint.playlistEditorEndpoint.playlistId;
                    }
                });

                // Extract basic information
                const title = renderer?.title?.runs?.[0]?.text || "";
                const subtitleRuns = renderer?.subtitle?.runs || [];

                // Build subtitle text (owner and track count)
                const subtitle = subtitleRuns
                    .map((run) => run?.text || "")
                    .join("")
                    .trim();

                // Extract owner from subtitle (first non-empty text before the bullet point)
                const owner = subtitleRuns?.[0]?.text || "";

                const thumbnail = renderer?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.pop()?.url || "";

                if (title && playlistId) {
                    playlists.push({
                        id: playlistId,
                        title: title,
                        subtitle: subtitle,
                        owner: owner,
                        thumbnail: thumbnail
                    });
                }
            });
        } catch (error) {
            console.error("Error parsing playlists:", error);
            throw error;
        }

        return playlists;
    }

    async getContiuationItems(continuationToken) {
        try {
            const response = await this.makePostRequest("/youtubei/v1/browse?prettyPrint=false", {
                context: window.ytcfg.data_.INNERTUBE_CONTEXT,
                continuation: continuationToken
            });
            return response;
        } catch (error) {
            console.error('Error fetching continuation items:', error);
            throw error;
        }
    }

    async getPlaylistItems(playlistId) {
        try {
            const response = await this.makePostRequest("/youtubei/v1/browse?prettyPrint=false", {
                context: window.ytcfg.data_.INNERTUBE_CONTEXT,
                browseId: `VL${playlistId}`
            });
            let allItems = [];
            if (response) {
                const records = response?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents?.[0]?.musicPlaylistShelfRenderer?.contents;
                const continuationToken = records?.[records.length - 1]?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
                const items = this.parsePlaylistItemsFromResponse(records);
                allItems = allItems.concat(items);
                // Check if there is a continuation token for more items
                //Has continuation token, which means there are more items to fetch.
                if (continuationToken) {
                    let nextToken = continuationToken;
                    while (nextToken) {
                        const continuationResponse = await this.getContiuationItems(nextToken);
                        const records = continuationResponse?.onResponseReceivedActions?.[0]?.appendContinuationItemsAction?.continuationItems;
                        nextToken = records?.[records.length - 1]?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
                        const items = this.parsePlaylistItemsFromResponse(records);
                        allItems = allItems.concat(items);
                    }
                }
            }
            return allItems;
        } catch (error) {
            console.error(`Error fetching items for playlist ${playlistId}:`, error);
            throw error;
        }
    }

    parsePlaylistItemsFromResponse(itemRenderers) {
        if (!itemRenderers) return [];
        const items = [];
        try {

            itemRenderers.forEach((itemWrapper) => {
                const musicItemRenderer = itemWrapper?.musicResponsiveListItemRenderer;

                if (musicItemRenderer) {
                    // Extract name/title from flexColumns[0]
                    const name = musicItemRenderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || "";

                    // Extract artist from flexColumns[1]

                    const artists = musicItemRenderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map(run => run.text).filter(text => text !== ', ' && text !== ' & ') || "";

                    // Extract album from flexColumns[2]
                    const album = musicItemRenderer?.flexColumns?.[2]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || "";

                    // Extract duration from fixedColumns[0]
                    const duration = musicItemRenderer?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.[0]?.text || "";

                    // Extract thumbnail URL
                    const thumbnailUrl = musicItemRenderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url || "";

                    // Check if item is greyed out (unavailable)
                    const isGreyedOut = musicItemRenderer?.musicItemRendererDisplayPolicy === "MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT";

                    const videoId = musicItemRenderer?.playlistItemData?.videoId || "";
                    const playlistSetVideoId = musicItemRenderer?.playlistItemData?.playlistSetVideoId || "";
                    //If MUSIC_VIDEO_TYPE_UGC, then type is video, else if MUSIC_VIDEO_TYPE_ATV then it's song
                    const typeOfItem = musicItemRenderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType === "MUSIC_VIDEO_TYPE_UGC" ? "VIDEO" : "SONG";

                    if (name) {
                        items.push({
                            name: name,
                            artists: artists,
                            album: album,
                            duration: duration,
                            thumbnail: thumbnailUrl,
                            isGreyedOut: isGreyedOut,
                            videoId: videoId,
                            playlistSetVideoId: playlistSetVideoId,
                            type: typeOfItem,
                            isVideo: typeOfItem === "VIDEO"
                        });
                    }
                }
            });
        } catch (error) {
            console.error("Error parsing playlist items:", error);
            throw error;
        }
        return items;
    }


    async searchMusic(query) {
        //Query will be a dictionary of name, artist, album, etc. You can construct the query string based on these parameters.
        // use only name: name, artists array and album name to construct the search query for better accuracy. For example: "song name artist1 artist2 album name",
        const queryString = `${query.name} ${query.artists ? query.artists.join(' ') : ''} ${query.album || ''}`.trim();
        try {
            const response = await this.makePostRequest("/youtubei/v1/search?prettyPrint=false", {
                context: window.ytcfg.data_.INNERTUBE_CONTEXT,
                query: queryString
            });
            return response;
        } catch (error) {
            console.error('Error performing search:', error);
            throw error;
        }
    }

    getBestSearchResult(searchResponse, originalQuery, similarityThreshold = 0.5) {
        const filterOutUnwantedTexts = [", ", " & ", " - ", "Song", "Video", " • "];
        try {
            // Navigate to search results content
            const sections = searchResponse?.contents?.tabbedSearchResultsRenderer?.tabs?.find(t => t.tabRenderer.tabIdentifier === "music_search_catalog")?.tabRenderer?.content?.sectionListRenderer?.contents || [];

            // First, try to find and extract from musicCardShelfRenderer (featured result)
            for (const section of sections) {
                const cardShelf = section?.musicCardShelfRenderer;
                const cardIsMusicItem = cardShelf?.subtitle?.runs?.some(run => run.text.toUpperCase() === "SONG" || run.text.toUpperCase() === "VIDEO");
                const musicShelf = section?.musicShelfRenderer;
                if (cardShelf && cardIsMusicItem) {
                    // Parse card result
                    const name = cardShelf?.title?.runs?.[0]?.text || "";
                    const thumbnail = cardShelf?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url || "";
                    const videoId = cardShelf?.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId || "";

                    // Parse subtitle to extract artist and duration
                    const subtitleRuns = cardShelf?.subtitle?.runs || [];
                    const subtitleText = subtitleRuns.map(run => run.text).join("");

                    // Extract artists (between first " • " and last " • ")
                    // Pattern: "Song • Artist1 & Artist2 • 5:24"
                    let artists = [];
                    let duration = "";
                    let isSong = false;
                    let isVideo = false;

                    if (subtitleRuns.length > 0) {
                        // Find duration (last part after last " • ")
                        const durationMatch = subtitleText.match(/(\d+:\d+)$/);
                        if (durationMatch) {
                            duration = durationMatch[1];
                        }

                        // Extract artists from subtitle runs, skipping "Song", separators, and duration
                        artists = subtitleRuns
                            .map(run => run.text)
                            .filter(text => text !== ' • ' && text !== ' & ' && !text.match(/^\d+:\d+$/) && text !== "Song")
                            .filter(text => text.trim() !== "");
                        isSong = subtitleRuns.some(run => run.text.toUpperCase() === "SONG");
                        isVideo = subtitleRuns.some(run => run.text.toUpperCase() === "VIDEO");
                    }

                    if (name) {
                        const isGoodMatch = this.isGoodMatch(originalQuery.name, name, similarityThreshold);
                        return {
                            name: name,
                            artists: artists,
                            album: "",
                            duration: duration,
                            thumbnail: thumbnail,
                            type: isSong ? "SONG" : isVideo ? "VIDEO" : "OTHER",
                            videoId: videoId,
                            isVideo: isVideo,
                            isGoodMatch: isGoodMatch
                        };
                    }
                }

                if (musicShelf) {
                    // If no card result, look for first music item in the shelf results
                    const itemRenderers = musicShelf?.contents || [];
                    for (const itemWrapper of itemRenderers) {
                        const musicItemRenderer = itemWrapper?.musicResponsiveListItemRenderer;
                        if (musicItemRenderer) {
                            const name = musicItemRenderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || "";

                            const artists = musicItemRenderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map(run => run.text).filter(text => !filterOutUnwantedTexts.includes(text)) || "";
                            const isSong = musicItemRenderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.some(run => run.text.toUpperCase() === "SONG");
                            const isVideo = musicItemRenderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.some(run => run.text.toUpperCase() === "VIDEO");
                            const album = musicItemRenderer?.flexColumns?.[2]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || "";
                            const duration = musicItemRenderer?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.[0]?.text || "";
                            const thumbnailUrl = musicItemRenderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url || "";
                            const videoId = musicItemRenderer?.playlistItemData?.videoId || "";
                            if (name) {
                                const isGoodMatch = this.isGoodMatch(originalQuery.name, name, similarityThreshold);
                                return {
                                    name: name,
                                    artists: artists,
                                    album: album,
                                    duration: duration,
                                    thumbnail: thumbnailUrl,
                                    type: isSong ? "SONG" : isVideo ? "VIDEO" : "OTHER",
                                    videoId: videoId,
                                    isVideo: isVideo,
                                    isGoodMatch: isGoodMatch
                                };
                            }
                        }
                    }
                }
            }

            return null; // No music item found in search results
        } catch (error) {
            console.error("Error parsing search results:", error);
            throw error;
        }
    }

    isGoodMatch(originalTitle, searchResultTitle, similarityThreshold) {
        if (!searchResultTitle) {
            console.log("No search result title found, considering it as no good replacement.");
            return false;
        }
        //Do a fuzzy match score check to see how good the best search result is compared to the original item, and if it's below a certain threshold, consider it as "No good replacement found"
        //Match should be based on title alone, since artist names can vary a lot and cause false negatives. We can use a simple string similarity algorithm like Levenshtein distance or Jaro-Winkler distance for this. For simplicity, let's just check if the best search result title contains the original title words and has a certain percentage of similarity.
        const titleSimilarity = UIHelper.isGoodMatch(originalTitle, searchResultTitle, similarityThreshold);
        console.log(`Title similarity between original and best search result: ${titleSimilarity}`);
        if (titleSimilarity === false) {
            console.log("Best search result is below similarity threshold, considering it as no good replacement.");
        }
        return titleSimilarity;
    }

    async addItemToPlaylist(playlistId, videoId) {
        try {
            const response = await this.makePostRequest("/youtubei/v1/browse/edit_playlist?prettyPrint=false", {
                context: window.ytcfg.data_.INNERTUBE_CONTEXT,
                actions: [
                    {
                        action: "ACTION_ADD_VIDEO",
                        addedVideoId: videoId,
                        dedupeOption: "DEDUPE_OPTION_CHECK"
                    }
                ],
                playlistId: playlistId
            });
            const success = response?.status === "STATUS_SUCCEEDED";
            return success;
        } catch (error) {
            console.error(`Error adding video ${videoId} to playlist ${playlistId}:`, error);
            throw error;
        }
    }

    async removeItemFromPlaylist(playlistId, videoId, playlistSetVideoId) {
        try {
            const response = await this.makePostRequest("/youtubei/v1/browse/edit_playlist?prettyPrint=false", {
                context: window.ytcfg.data_.INNERTUBE_CONTEXT,
                actions: [
                    {
                        action: "ACTION_REMOVE_VIDEO",
                        removedVideoId: videoId,
                        setVideoId: playlistSetVideoId
                    }
                ],
                playlistId: playlistId
            });
            const success = response?.status === "STATUS_SUCCEEDED";
            if (!success) {
                throw new Error(`Failed to remove video ${videoId} from playlist ${playlistId}. Response: ${JSON.stringify(response)}`);
            }
            return success;
        } catch (error) {
            console.error(`Error removing video ${videoId} from playlist ${playlistId}:`, error);
            throw error;
        }
    }

    getCurrentPlaylistIdFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const listParam = urlParams.get('list');

        return listParam;
    }
}