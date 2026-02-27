/**
 * Bridge Script - Runs in page context to access window variables
 * This script extracts window.ytconfig and sends it to the content script via postMessage
 * Periodically fetches the config to ensure fresh data
 */
import { YTMusicAPI } from './yt-music-api.js';
import { UIHelper } from '../utils/ui-helper.js';
(function () {

    function fetchAuthToken() {
        // // Injected Bridge Script
        const constantHeader = "Authorization"; // or "X-Goog-AuthUser", etc.
        const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;


        XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
            if (window.bridgeInstance.ytMusicAPI.isAuthTokenSet()) {
                // If we already have the auth token, we can restore setRequestHeader to original to avoid overhead
                XMLHttpRequest.prototype.setRequestHeader = originalSetRequestHeader;
                return originalSetRequestHeader.apply(this, arguments);
            }
            if (header.toLowerCase() === "authorization") {
                console.log("Captured Auth Header:", value);
                window.bridgeInstance.setAuthToken(value); // Store it in the bridge for potential future use
                // Reset the setRequestHeader to original
                XMLHttpRequest.prototype.setRequestHeader = originalSetRequestHeader;
            }
            return originalSetRequestHeader.apply(this, arguments);
        };

        const { fetch: originalFetch } = window;

        window.fetch = async (...args) => {
            if (window.bridgeInstance.ytMusicAPI.isAuthTokenSet()) {
                // If we already have the auth token, we can restore fetch to original to avoid overhead
                window.fetch = originalFetch;
                return originalFetch(...args);
            }
            try {
                let request = args[0];
                // 1. Check if headers exist in the fetch call
                const headers = request.headers;
                if (!headers) {
                    return originalFetch(...args); // If no headers, just proceed with original fetch
                }

                console.log("Fetch called with resource:", request, "and headers:", headers);
                if (headers && request.url.includes("music.youtube.com")) { // You can adjust this condition to target specific API calls
                    let authToken = null;

                    // 2. Handle different Header formats (Object or Headers instance)
                    if (headers instanceof Headers) {
                        authToken = headers.get("Authorization");
                    } else {
                        authToken = headers["Authorization"] || headers["authorization"];
                    }
                    console.log("Captured Auth Token from fetch:", authToken);
                    // 3. If found, relay it to the Content Script
                    if (authToken) {
                        window.bridgeInstance.setAuthToken(authToken); // Store it in the bridge for potential future use
                    }
                    // Reset fetch to original after capturing the token to avoid interference with other calls
                    window.fetch = originalFetch;
                }

                return originalFetch(...args);
            } catch (error) {
                console.error("Error in fetch wrapper:", error);
                return originalFetch(...args); // Fallback to original fetch in case of error 
            };
        };
    }

    class Bridge {
        constructor() {
            this.ytMusicAPI = new YTMusicAPI();

            this.baseUrl = "https://music.youtube.com/watch?v=";
            this.timeOutDuration = 100;
            this.isReloadDisabled = false;
            this.preventUnloadListener = (e) => {
                if (this.isReloadDisabled) {
                    e.preventDefault();
                    e.returnValue = '';
                    console.log('Page reload prevented during API operations');
                }
            };
        }

        sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        /**
         * Disable page reloads during API operations
         * YouTube Music's internal code will attempt to reload after API calls, but we prevent it
         */
        disableReload() {
            if (this.isReloadDisabled) return;
            this.isReloadDisabled = true;

            // Add beforeunload listener to prevent page navigation/reload
            window.addEventListener('beforeunload', this.preventUnloadListener);
            console.log('Page reload disabled - API operations can proceed without interruption');
        }

        /**
         * Re-enable page reloads and optionally reload the page
         * @param {boolean} shouldReload - If true, reload the page after re-enabling
         */
        enableReload(shouldReload = true) {
            if (!this.isReloadDisabled) return;

            this.isReloadDisabled = false;

            // Remove beforeunload listener to allow navigation again
            window.removeEventListener('beforeunload', this.preventUnloadListener);
            console.log('Page reload enabled');

            if (shouldReload) {
                console.log('Reloading page to reflect changes');
                window.location.reload();
            }
        }

        setAuthToken(token) {
            console.log("Setting auth token in bridge:", token);
            this.ytMusicAPI.setAuthToken(token);
            this.addEventListeners();
            this.initPLaylistFetching();
        }
        addEventListeners() {
            const findUnavailableBtn = document.getElementById('findUnavailableBtn');
            if (findUnavailableBtn) {
                findUnavailableBtn.addEventListener('click', () => this.findUnavailableTracks());
            }

            const findVideoTracksBtn = document.getElementById('findVideoTracksBtn');
            if (findVideoTracksBtn) {
                findVideoTracksBtn.addEventListener('click', () => this.findVideoTracks());
            }

            const replaceSelectedBtn = document.getElementById('replaceSelectedBtn');
            if (replaceSelectedBtn) {
                replaceSelectedBtn.addEventListener('click', () => this.replaceSelectedItems());
            }

            const addSelectedBtn = document.getElementById('addSelectedBtn');
            if (addSelectedBtn) {
                addSelectedBtn.addEventListener('click', () => this.addSelectedItems());
            }

            const removeSelectedBtn = document.getElementById('removeSelectedBtn');
            if (removeSelectedBtn) {
                removeSelectedBtn.addEventListener('click', () => this.removeSelectedItems());
            }
        }
        /**
         * Toggle the search progress spinner
         * @param {boolean} show
         */
        toggleSearchProgress(show) {
            const el = document.getElementById('searchProgress');
            if (el) {
                if (show) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            }
            // also disable/enable search buttons to prevent duplicate clicks
            const findUnavailable = document.getElementById('findUnavailableBtn');
            const findVideo = document.getElementById('findVideoTracksBtn');
            const replaceSelected = document.getElementById('replaceSelectedBtn');
            const addSelected = document.getElementById('addSelectedBtn');
            const removeSelected = document.getElementById('removeSelectedBtn');
             if (replaceSelected) replaceSelected.disabled = show;
             if (addSelected) addSelected.disabled = show;
             if (removeSelected) removeSelected.disabled = show;
            if (findUnavailable) findUnavailable.disabled = show;
            if (findVideo) findVideo.disabled = show;
        }
        async initPLaylistFetching() {
            // Get all editable playlists for the user
            const playlists = await this.ytMusicAPI.getEditablePlaylists();
            console.log("Fetched playlists in bridge:", playlists);
            //Check if the current page is a playlist page and get the playlist ID from the URL
            const currentPlaylistId = this.ytMusicAPI.getCurrentPlaylistIdFromURL();
            console.log("Current playlist ID from URL:", currentPlaylistId);
            //Check if the current playlist ID is in the list of editable playlists
            const currentPlaylist = playlists.find(playlist => playlist.id === currentPlaylistId);
            if (currentPlaylist) {
                UIHelper.setPlaylistDetails(currentPlaylist);

                //Open popup
                window.postMessage({ type: 'OPEN_POPUP' }, '*');
            } else {
                console.log("Current playlist ID is not in the list of editable playlists or no playlist ID found in URL.");
            }

        }

        async processPlaylistItems(items) {
            // Process the playlist items to find greyed out ones and fetch replacement suggestions for first 4 greyed out items (for testing purposes, remove the limit to process all greyed out items)
            const greyedOutItems = items.filter(item => item.isGreyedOut).slice(0, 5);
            console.log("Greyed out items in the playlist:", greyedOutItems);
            this.clearPlaylistItemsContainer();
            let i = 1;
            for (const greyedOutItem of greyedOutItems) {
                console.log("Processing greyed out item:", greyedOutItem);
                const searchResult = await this.ytMusicAPI.searchMusic(greyedOutItem);
                console.log("Search result for greyed out item:", searchResult);
                let bestSearchResult = null;
                try {
                    bestSearchResult = this.ytMusicAPI.getBestSearchResult(searchResult, greyedOutItem);

                } catch (error) {
                    console.error("Error finding best search result for item:", greyedOutItem, "Search results were:", searchResult, "Error was:", error);
                }
                console.log("Best search result for greyed out item:", bestSearchResult, "Original item:", greyedOutItem);


                // Here you can decide what to do with the best search result, e.g., show it in the popup or automatically replace the item in the playlist
                // Append the original item object to add the replacement media object for easier handling in the UI
                greyedOutItem.replacement = bestSearchResult;
                //Show the greyed out item and its best search result in the UI
                this.addItem(greyedOutItem, this.baseUrl, i++);

                await this.sleep(this.timeOutDuration); // Sleep for a bit to avoid hitting rate limits or overwhelming the API with requests
            }
            // After processing all items, modify the UI to show the results
            //this.displayResultsInUI(greyedOutItems);
        }

        async displayResultsInUI(greyedOutItems) {
            //Empty the container first
            this.clearPlaylistItemsContainer();
            let i = 1;
            for (const item of greyedOutItems) {
                i = this.addItem(item, this.baseUrl, i);
            }
        }

        clearPlaylistItemsContainer() {
            const container = document.getElementById('yt-music-plus-itemsGridContainer');
            container.replaceChildren();
        }

        addItem(item, baseUrl, i) {
            console.log("Displaying item in UI:", item);
            const originalMedia = {
                name: item.name,
                artist: item.artists.join(", "),
                thumbnail: item.thumbnail,
                url: baseUrl + item.videoId,
                videoId: item.videoId,
                playlistSetVideoId: item.playlistSetVideoId
            };
            const replacementMedia = item.replacement ? {
                name: item.replacement.name,
                artist: item.replacement.artists.join(", "),
                thumbnail: item.replacement.thumbnail,
                url: baseUrl + item.replacement.videoId,
                isGoodMatch: item.replacement.isGoodMatch,
                videoId: item.replacement.videoId,
                playlistSetVideoId: item.replacement.playlistSetVideoId
            } : null;
            const gridRow = UIHelper.createMediaGridRow(originalMedia, replacementMedia, i++);
            document.getElementById('yt-music-plus-itemsGridContainer').appendChild(gridRow);
            return i;
        }

        async findUnavailableTracks() {
            this.toggleSearchProgress(true);
            try {
                const currentPlaylistId = this.ytMusicAPI.getCurrentPlaylistIdFromURL();
                console.log("Current playlist ID from URL:", currentPlaylistId);

                if (!currentPlaylistId) {
                    console.error("Could not determine current playlist ID from URL");
                    return;
                }

                console.log("Fetching items for playlist:", currentPlaylistId);
                const items = await this.ytMusicAPI.getPlaylistItems(currentPlaylistId);
                console.log("Fetched playlist items:", items);

                // Filter for unavailable (greyed out) tracks
                const unavailableItems = items.filter(item => item.isGreyedOut);
                console.log("Unavailable (greyed out) items:", unavailableItems);

                if (unavailableItems.length === 0) {
                    console.log("No unavailable tracks found in the playlist");
                    return;
                }

                // Process the unavailable items to find replacements
                await this.processPlaylistItems(unavailableItems);
            } catch (error) {
                console.error('Error finding unavailable tracks:', error);
            } finally {
                this.toggleSearchProgress(false);
            }
        }

        async findVideoTracks() {
            this.toggleSearchProgress(true);
            try {
                const currentPlaylistId = this.ytMusicAPI.getCurrentPlaylistIdFromURL();
                console.log("Current playlist ID from URL:", currentPlaylistId);

                if (!currentPlaylistId) {
                    console.error("Could not determine current playlist ID from URL");
                    return;
                }

                console.log("Fetching items for playlist:", currentPlaylistId);
                const items = await this.ytMusicAPI.getPlaylistItems(currentPlaylistId);
                console.log("Fetched playlist items:", items);

                // Filter for video tracks (non-music items or items with video property set)
                const videoTracks = items.filter(item => item.isVideo);
                console.log("Video tracks found:", videoTracks);

                if (videoTracks.length === 0) {
                    console.log("No video tracks found in the playlist");
                    return;
                }
                let i = 1;
                for (const track of videoTracks) {
                    console.log("Video track details:", track);
                    //Remove any video-specific keywords from the track name to improve search results, e.g., "Official Video", "Music Video", etc.
                    console.log("Original track name before cleaning:", track.name);
                    // Ensure regex is global; replaceAll requires either a string or a global RegExp
                    track.name = track.name.replaceAll(/(official\s*)?(music\s*)?video/ig, "").trim();
                    console.log("Cleaned track name for searching:", track.name);
                    const searchResult = await this.ytMusicAPI.searchMusic(track);
                    console.log("Search result for video track:", searchResult);
                    const replacement = this.ytMusicAPI.getBestSearchResult(track, track);
                    console.log("Best search result for video track:", replacement);
                    track.replacement = replacement; // Attach the replacement to the track for easier handling in the UI
                    this.addItem(track, this.baseUrl, i++); // Show the video track and its best search result in the UI
                    await this.sleep(this.timeOutDuration); // Sleep for a bit to avoid hitting rate limits or overwhelming the API with requests
                }
            } catch (error) {
                console.error('Error finding video tracks:', error);
            } finally {
                this.toggleSearchProgress(false);
            }
        }
        async replaceSelectedItems() {
            try {
                this.toggleSearchProgress(true);
                // This function will be called when the user clicks the "Replace Selected" button in the popup
                // It should gather the selected items in the UI, get their corresponding replacement media, and call the API to replace them in the playlist
                const playlistId = this.ytMusicAPI.getCurrentPlaylistIdFromURL();
                if (!playlistId) {
                    console.error("Could not determine current playlist ID from URL");
                    return;
                }
                console.log("Replace Selected button clicked");
                const selectedItems = UIHelper.getSelectedMediaItems();
                console.log("Selected items to replace:", selectedItems);
                for (const item of selectedItems) {
                    if (item.replacementMedia && item.replacementMedia.videoId) {
                        try {
                            const originalItemDetails = item.originalMedia;
                            const replacementItemDetails = item.replacementMedia;
                            console.log("Original item details for adding:", originalItemDetails);
                            console.log("Replacement item details for adding:", replacementItemDetails);

                            await this.ytMusicAPI.addItemToPlaylist(playlistId, replacementItemDetails.videoId);
                            await this.ytMusicAPI.removeItemFromPlaylist(playlistId, originalItemDetails.videoId, originalItemDetails.playlistSetVideoId);
                            console.log(`Replaced item ${originalItemDetails.name} with ${replacementItemDetails.name} in the playlist`);
                        } catch (error) {
                            console.error(`Error replacing item ${originalItemDetails.name} with ${replacementItemDetails.name} in the playlist:`, error);
                        }
                    } else {
                        console.warn(`No replacement found for item ${originalItemDetails.name}, skipping replacement.`);
                    }
                }
                console.log('All replacements completed.');
            }
            finally {
                this.toggleSearchProgress(false);
            }
        }
        async addSelectedItems() {
            this.toggleSearchProgress(true);
            try {
                // This function will be called when the user clicks the "Add Selected" button in the popup
                // It should gather the selected items in the UI, get their corresponding replacement media, and call the API to add them to the playlist
                console.log("Add Selected button clicked");
                const playlistId = this.ytMusicAPI.getCurrentPlaylistIdFromURL();
                if (!playlistId) {
                    console.error("Could not determine current playlist ID from URL");
                    return;
                }
                const selectedItems = UIHelper.getSelectedMediaItems();
                console.log("Selected items to add:", selectedItems);
                for (const item of selectedItems) {
                    const originalItemDetails = item.originalMedia;
                    const replacementItemDetails = item.replacementMedia;
                    console.log("Original item details for adding:", originalItemDetails);
                    console.log("Replacement item details for adding:", replacementItemDetails);
                    if (replacementItemDetails && replacementItemDetails.videoId) {
                        try {
                            await this.ytMusicAPI.addItemToPlaylist(playlistId, replacementItemDetails.videoId);
                            console.log(`Added item ${replacementItemDetails.name} to the playlist`);
                        } catch (error) {
                            console.error(`Error adding item ${replacementItemDetails.name} to the playlist:`, error);
                        }
                    } else {
                        console.warn(`No valid replacement found for item ${originalItemDetails.name}, skipping addition.`);
                    }
                }
                console.log('All additions completed.');
            }
            finally {
                this.toggleSearchProgress(false);
            }
        }

        async removeSelectedItems() {
            try {
                this.toggleSearchProgress(true);
                // This function will be called when the user clicks the "Remove Selected" button in the popup
                // It should gather the selected items in the UI and call the API to remove them from the playlist
                const playlistId = this.ytMusicAPI.getCurrentPlaylistIdFromURL();
                if (!playlistId) {
                    console.error("Could not determine current playlist ID from URL");
                    return;
                }
                console.log("Remove Selected button clicked");
                const selectedItems = UIHelper.getSelectedMediaItems();
                console.log("Selected items to remove:", selectedItems);
                for (const item of selectedItems) {
                    try {
                        const originalItemDetails = item.originalMedia;
                        const replacementItemDetails = item.replacementMedia;
                        console.log("Original item details for removal:", originalItemDetails);
                        console.log("Replacement item details for removal:", replacementItemDetails);

                        await this.ytMusicAPI.removeItemFromPlaylist(playlistId, originalItemDetails.videoId, originalItemDetails.playlistSetVideoId);
                        console.log(`Removed item ${originalItemDetails.name} from the playlist`);
                    } catch (error) {
                        console.error(`Error removing item ${originalItemDetails.name} from the playlist:`, error);
                    }
                }
                console.log('All removals completed.')
            }

            finally {
                this.toggleSearchProgress(false);
            }
        }
    }
    window.bridgeInstance = new Bridge(); // Expose the Bridge class to the global scope


    // Listen for messages from content script
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;

        // Handle popup close event
        if (event.data.type === 'POPUP_CLOSED') {
            console.log('Popup closed, re-enabling page reload');
            window.bridgeInstance.enableReload();
        }

        // Disable page reloads when popup is opened to prevent interference with API operations
        if (event.data.type === 'OPEN_POPUP') {
            console.log('Popup opened, disabling page reload to prevent interference with API operations');
            window.bridgeInstance.disableReload();
        }
    });
    window.postMessage({ type: 'BRIDGE_LOADED' }, '*');
    console.log('Bridge script loaded and ready to fetch variables');

    // Start fetching the auth token immediately after the bridge is loaded
    fetchAuthToken();

})();
