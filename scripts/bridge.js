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
            this.currentSelectedPlaylist = null; // Store the currently selected playlist details
            this.baseUrl = "https://music.youtube.com/watch?v=";
            this.timeOutDuration = 100;
            this.pageLoadTimeout = 3000;
            this.isReloadDisabled = false;
            this.playlistsCache = []; // Cache to store fetched playlist items to minimize API calls
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
        enableReload(shouldReload = false) {
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
            this.injectActionButtons();
            this.showTriggerButtons();
        }

        injectActionButtons() {
            const existingButtons = document.getElementById('yt-music-plus-action-buttons');
            if (existingButtons) {
                console.warn('Action buttons already exist, skipping injection.');
                return;
            }
            const header = document.querySelector('ytmusic-responsive-header-renderer');
            if (!header) {
                console.warn('Could not find the header to inject action buttons.');
                return;
            }
            const actionButtons = document.createElement('div');
            actionButtons.id = 'yt-music-plus-action-buttons';
            actionButtons.classList.add('action-buttons', 'style-scope', 'ytmusic-responsive-header-renderer', 'hidden');

            const innerDiv = document.createElement('div');
            innerDiv.className = 'style-scope';
            innerDiv.setAttribute('role', 'button');
            innerDiv.setAttribute('tabindex', '0');

            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'content-wrapper style-scope ytmusic-play-button-renderer';
            const span = document.createElement('span');
            span.className = 'icon style-scope';
            span.textContent = 'YouTube Music +';
            contentWrapper.appendChild(span);
            innerDiv.appendChild(contentWrapper);
            actionButtons.appendChild(innerDiv);

            actionButtons.addEventListener('click', () => {
                this.showPopup();
            });
            header.appendChild(actionButtons);

        }

        showTriggerButtons() {
            const naavBarBtn = document.getElementById('yt-music-plus-nav-btn');
            if (naavBarBtn) {
                naavBarBtn.classList.remove('hidden');
            }
            const playlistActionBtn = document.getElementById('yt-music-plus-action-buttons');
            if (playlistActionBtn) {
                playlistActionBtn.classList.remove('hidden');
            }
        }
        async showPopup() {
            const popupElement = document.getElementById('yt-music-plus-popup');
            if (popupElement) {
                popupElement.classList.remove('hidden');
            }
            await this.initPlaylistFetching();
            const currentPlaylistId = this.ytMusicAPI.getCurrentPlaylistIdFromURL();
            const playlistFromCache = this.playlistsCache.find(pl => pl.id === currentPlaylistId);
            if (currentPlaylistId) {
                this.onPlaylistSelected(playlistFromCache);
            }
        }

        hidePopup() {
            const popupElement = document.getElementById('yt-music-plus-popup');
            if (popupElement) {
                popupElement.classList.add('hidden');
            }
            window.bridgeInstance.enableReload();
        }
        addEventListeners() {
            //Add listener for page navigation, back, forward etc
            navigation.addEventListener('navigate', (event) => {
                if (event.navigationType != 'push') {
                    return;
                }
                const isPlaylistPage = event.destination.url.startsWith('https://music.youtube.com/playlist');
                if (isPlaylistPage) {
                    setTimeout(() => {
                        this.injectActionButtons();
                        this.showTriggerButtons();
                    }, this.pageLoadTimeout);
                }
            });

            const navBarBtn = document.getElementById('yt-music-plus-nav-btn');
            if (navBarBtn) {
                navBarBtn.addEventListener('click', () => {
                    this.showPopup();
                });
            }

            // Add close button listener
            const popupElement = document.getElementById('yt-music-plus-popup');
            const closeBtn = popupElement.querySelector('#closePopupBtn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.hidePopup());
                popupElement.addEventListener('click', (event) => {
                    if (event.target === popupElement) {
                        this.hidePopup();
                    }
                });

                // Close popup on Escape key
                const handleEscapeKey = (e) => {
                    if (e.key === 'Escape' && popupElement.classList.contains('hidden') === false) {
                        this.hidePopup();
                    }
                };
                document.addEventListener('keydown', handleEscapeKey);
            }


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
            const backBtn = document.getElementById('backButton');
            if (backBtn) backBtn.disabled = show;
            if (replaceSelected) replaceSelected.disabled = show;
            if (addSelected) addSelected.disabled = show;
            if (removeSelected) removeSelected.disabled = show;
            if (findUnavailable) findUnavailable.disabled = show;
            if (findVideo) findVideo.disabled = show;
            this.setCheckAllCheckBox(); // Ensure checkboxes are also disabled/enabled appropriately
        }

        setCheckAllCheckBox() {
            const popupElement = document.querySelector('.yt-music-extended-popup-container');
            const selectAllCheckbox = popupElement.querySelector('#yt-music-plus-selectAllCheckbox');
            const checkboxes = popupElement.querySelectorAll('.item-checkbox');
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            selectAllCheckbox.checked = allChecked;

            //If none of the checkboxes are checked, disable the action buttons, else enable them
            const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
            const actionButtons = popupElement.querySelectorAll('.action-buttons-container button');
            actionButtons.forEach(btn => btn.disabled = !anyChecked);
        }
        hidePlaylistLoadingIndicator() {
            const loadingIndicator = document.getElementById('playlistsLoadingIndicator');
            if (loadingIndicator) {
                loadingIndicator.classList.add('hidden');
            }
        }

        async initPlaylistFetching() {
            // Get all editable playlists for the user
            this.playlistsCache = await this.ytMusicAPI.getEditablePlaylists();
            console.log("Fetched playlists in bridge:", this.playlistsCache);

            // Display all playlists in the selection screen
            this.displayPlaylistsForSelection();
            this.hidePlaylistLoadingIndicator();
        }

        displayPlaylistsForSelection() {
            const playlistsGrid = document.getElementById('playlistsGrid');
            if (!playlistsGrid) {
                console.error("Playlists grid container not found");
                return;
            }

            // Clear existing playlist cards
            playlistsGrid.replaceChildren();

            if (this.playlistsCache.length === 0) {
                const noPlaylistsMessage = document.createElement('div');
                noPlaylistsMessage.style.gridColumn = '1/-1';
                noPlaylistsMessage.style.padding = '20px';
                noPlaylistsMessage.style.textAlign = 'center';
                noPlaylistsMessage.textContent = 'No editable playlists found';
                playlistsGrid.appendChild(noPlaylistsMessage);
                return;
            }

            // Create a playlist card for each playlist
            this.playlistsCache.forEach((playlist) => {
                const card = UIHelper.createPlaylistCard(playlist);

                // Add click handler to select the playlist
                card.addEventListener('click', () => {
                    this.onPlaylistSelected(playlist);
                });

                playlistsGrid.appendChild(card);
            });
        }

        onPlaylistSelected(playlist) {
            console.log("Playlist selected:", playlist);

            // Set the playlist details in the UI
            UIHelper.setPlaylistDetails(playlist);
            if (!this.currentSelectedPlaylist || this.currentSelectedPlaylist.id !== playlist.id) {
                this.clearPlaylistItemsContainer(); // Clear any existing items in the details screen

                // Store the current playlist for reference
                this.currentSelectedPlaylist = playlist;
                this.setProgressText("");
            }
            // Switch to details screen
            const detailsScreen = document.getElementById('playlistDetailsScreen');
            if (detailsScreen) {
                detailsScreen.classList.remove('hidden');
            }
            const selectionScreen = document.getElementById('playlistSelectionScreen');
            if (selectionScreen) {
                selectionScreen.classList.add('hidden');
            }
            this.updatePopupTitle(`Playlist: ${playlist.title}`);
        }

        updatePopupTitle(title) {
            const titleElement = document.getElementById('popupTitle');
            if (titleElement) {
                titleElement.textContent = title;
            }
        }

        async processPlaylistItems(items) {
            // Process the playlist items to find greyed out ones and fetch replacement suggestions for first 4 greyed out items (for testing purposes, remove the limit to process all greyed out items)
            const greyedOutItems = items.filter(item => item.isGreyedOut).slice(0, 10);
            console.log("Greyed out items in the playlist:", greyedOutItems);
            this.clearPlaylistItemsContainer();
            let i = 1;
            for (const greyedOutItem of greyedOutItems) {
                this.setProgressText(`Processing track ${i} of ${greyedOutItems.length}`);
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
            var progressText = greyedOutItems.length > 0 ? `Processing complete. Found ${greyedOutItems.length} unavailable tracks and their replacements.` : "Processing complete. No unavailable tracks found in the playlist.";
            var hasBadMatches = greyedOutItems.some(item => item.replacement && !item.replacement.isGoodMatch);
            if (hasBadMatches) {
                progressText += " Some replacements may not be good matches, please review carefully before replacing.";
            }
            this.setProgressText(progressText);
            // After processing all items, modify the UI to show the results
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
        setProgressText(text) {
            const el = document.getElementById('progressText');
            if (el) {
                el.textContent = text;
                if (text) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            }
        }

        async findUnavailableTracks() {
            this.clearPlaylistItemsContainer();
            this.toggleSearchProgress(true);
            this.setProgressText("Finding unavailable tracks...");
            try {
                const currentPlaylistId = this.currentSelectedPlaylist ? this.currentSelectedPlaylist.id : this.ytMusicAPI.getCurrentPlaylistIdFromURL();
                console.log("Current playlist ID:", currentPlaylistId);

                if (!currentPlaylistId) {
                    console.error("Could not determine current playlist ID from URL or selected playlist");
                    return;
                }

                console.log("Fetching items for playlist:", currentPlaylistId);
                const items = await this.ytMusicAPI.getPlaylistItems(currentPlaylistId);
                console.log("Fetched playlist items:", items);

                // Filter for unavailable (greyed out) tracks
                const unavailableItems = items.filter(item => item.isGreyedOut);
                console.log("Unavailable (greyed out) items:", unavailableItems);
                this.setProgressText(`Found ${unavailableItems.length} unavailable tracks. Fetching replacements...`);

                if (unavailableItems.length === 0) {
                    console.log("No unavailable tracks found in the playlist");
                    return;
                }

                // Process the unavailable items to find replacements
                await this.processPlaylistItems(unavailableItems);
            } catch (error) {
                this.setProgressText("Error occurred while finding unavailable tracks. Check console for details.");
                console.error('Error finding unavailable tracks:', error);
            } finally {
                this.toggleSearchProgress(false);
            }
        }

        async findVideoTracks() {
            this.clearPlaylistItemsContainer();
            this.toggleSearchProgress(true);
            this.setProgressText("Finding video tracks...");
            try {
                const currentPlaylistId = this.currentSelectedPlaylist ? this.currentSelectedPlaylist.id : this.ytMusicAPI.getCurrentPlaylistIdFromURL();
                console.log("Current playlist ID:", currentPlaylistId);

                if (!currentPlaylistId) {
                    console.error("Could not determine current playlist ID from URL or selected playlist");
                    return;
                }

                console.log("Fetching items for playlist:", currentPlaylistId);
                const items = await this.ytMusicAPI.getPlaylistItems(currentPlaylistId);
                console.log("Fetched playlist items:", items);

                // Filter for video tracks (non-music items or items with video property set)
                const videoTracks = items.filter(item => item.isVideo);
                console.log("Video tracks found:", videoTracks);
                this.setProgressText(`Found ${videoTracks.length} video tracks. Fetching replacements...`);
                if (videoTracks.length === 0) {
                    console.log("No video tracks found in the playlist");
                    return;
                }

                this.clearPlaylistItemsContainer();
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
                const progressText = videoTracks.length > 0 ? `Processing complete. Found ${videoTracks.length} video tracks and their replacements.` : "Processing complete. No video tracks found in the playlist.";
                const countOfReplacementsFound = videoTracks.filter(track => track.replacement).length;
                const countOfGoodMatches = videoTracks.filter(track => track.replacement && track.replacement.isGoodMatch).length;
                if (countOfReplacementsFound === 0) {
                    this.setProgressText(progressText + " No replacements found for video tracks.");
                } else if (countOfGoodMatches === 0) {
                    this.setProgressText(progressText + ` Replacements were found for ${countOfReplacementsFound} video tracks, but none were good matches. Please review carefully before replacing.`);
                } else if (countOfGoodMatches < countOfReplacementsFound) {
                    this.setProgressText(progressText + ` Replacements were found for ${countOfReplacementsFound} video tracks, but only ${countOfGoodMatches} were good matches. Please review carefully before replacing.`);
                } else {
                    this.setProgressText(progressText);
                }
            } catch (error) {
                console.error('Error finding video tracks:', error);
                this.setProgressText("Error occurred while finding video tracks. Check console for details.");
            } finally {
                this.toggleSearchProgress(false);
            }
        }
        beforeActionsOnSelectedItems() {
            // This function can be used to perform any necessary steps before performing actions on the selected items, such as disabling page reloads, showing confirmation dialogs, etc.
            // For example, we can disable page reloads to prevent YouTube Music from interrupting our API operations:
            this.disableReload();
            this.toggleSearchProgress(true);
        }
        afterActionsOnSelectedItems() {
            // This function can be used to perform any necessary steps after performing actions on the selected items, such as re-enabling page reloads, showing success messages, etc.
            // For example, we can re-enable page reloads after our API operations are complete:
            this.enableReload();
            this.toggleSearchProgress(false);
        }

        async replaceSelectedItems() {
            try {
                this.beforeActionsOnSelectedItems();
                this.setProgressText("Replacing selected items...");
                // This function will be called when the user clicks the "Replace Selected" button in the popup
                // It should gather the selected items in the UI, get their corresponding replacement media, and call the API to replace them in the playlist
                const playlistId = this.currentSelectedPlaylist ? this.currentSelectedPlaylist.id : this.ytMusicAPI.getCurrentPlaylistIdFromURL();
                if (!playlistId) {
                    console.error("Could not determine current playlist ID from URL or selected playlist");
                    return;
                }
                console.log("Replace Selected button clicked");
                const selectedItems = UIHelper.getSelectedMediaItems();
                console.log("Selected items to replace:", selectedItems);
                let i = 1;
                for (const item of selectedItems) {
                    this.setProgressText(`Replacing track ${i} of ${selectedItems.length}...`);
                    if (item.replacementMedia && item.replacementMedia.videoId) {
                        try {
                            const originalItemDetails = item.originalMedia;
                            const replacementItemDetails = item.replacementMedia;
                            console.log("Original item details for adding:", originalItemDetails);
                            console.log("Replacement item details for adding:", replacementItemDetails);

                            await this.ytMusicAPI.addItemToPlaylist(playlistId, replacementItemDetails.videoId);
                            await this.ytMusicAPI.removeItemFromPlaylist(playlistId, originalItemDetails.videoId, originalItemDetails.playlistSetVideoId);
                            console.log(`Replaced item ${originalItemDetails.name} with ${replacementItemDetails.name} in the playlist`);
                            UIHelper.removeMediaGridRow(originalItemDetails); // Remove the item from the UI immediately after replacement
                        } catch (error) {
                            console.error(`Error replacing item ${originalItemDetails.name} with ${replacementItemDetails.name} in the playlist:`, error);
                        }
                    } else {
                        console.warn(`No replacement found for item ${originalItemDetails.name}, skipping replacement.`);
                    }
                    i++;
                }
                const countOfItemsReplaced = selectedItems.filter(item => item.replacementMedia && item.replacementMedia.videoId).length;
                const progressText = countOfItemsReplaced > 0 ? `All replacements completed. Replaced ${countOfItemsReplaced} items in the playlist.` : "All replacements completed. No valid replacements were made to the playlist.";
                this.setProgressText(progressText);
                console.log('All replacements completed.');
            }
            catch (error) {
                console.error('Error replacing selected items:', error);
                this.setProgressText("Error occurred while replacing items. Check console for details.");
            }
            finally {
                this.afterActionsOnSelectedItems();
            }
        }
        async addSelectedItems() {
            this.beforeActionsOnSelectedItems();
            this.setProgressText("Adding selected items...");
            try {
                // This function will be called when the user clicks the "Add Selected" button in the popup
                // It should gather the selected items in the UI, get their corresponding replacement media, and call the API to add them to the playlist
                console.log("Add Selected button clicked");
                const playlistId = this.currentSelectedPlaylist ? this.currentSelectedPlaylist.id : this.ytMusicAPI.getCurrentPlaylistIdFromURL();
                if (!playlistId) {
                    console.error("Could not determine current playlist ID from URL or selected playlist");
                    return;
                }
                const selectedItems = UIHelper.getSelectedMediaItems();
                console.log("Selected items to add:", selectedItems);
                let i = 1;
                for (const item of selectedItems) {
                    this.setProgressText(`Adding track ${i} of ${selectedItems.length}...`);
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
                    i++;
                }
                const countOfItemsAdded = selectedItems.filter(item => item.replacementMedia && item.replacementMedia.videoId).length;
                const progressText = countOfItemsAdded > 0 ? `All additions completed. Added ${countOfItemsAdded} items to the playlist.` : "All additions completed. No valid items were added to the playlist.";
                this.setProgressText(progressText);
                console.log('All additions completed.');
            }
            catch (error) {
                console.error('Error adding selected items:', error);
                this.setProgressText("Error occurred while adding items. Check console for details.");
            }
            finally {
                this.afterActionsOnSelectedItems();
            }
        }

        async removeSelectedItems() {
            try {
                this.beforeActionsOnSelectedItems();
                this.setProgressText("Removing selected items...");

                // This function will be called when the user clicks the "Remove Selected" button in the popup
                // It should gather the selected items in the UI and call the API to remove them from the playlist
                const playlistId = this.currentSelectedPlaylist ? this.currentSelectedPlaylist.id : this.ytMusicAPI.getCurrentPlaylistIdFromURL();
                if (!playlistId) {
                    console.error("Could not determine current playlist ID from URL or selected playlist");
                    return;
                }
                console.log("Remove Selected button clicked");
                const selectedItems = UIHelper.getSelectedMediaItems();
                console.log("Selected items to remove:", selectedItems);
                let i = 1;
                for (const item of selectedItems) {
                    this.setProgressText(`Removing track ${i} of ${selectedItems.length}...`);
                    try {
                        const originalItemDetails = item.originalMedia;
                        const replacementItemDetails = item.replacementMedia;
                        console.log("Original item details for removal:", originalItemDetails);
                        console.log("Replacement item details for removal:", replacementItemDetails);

                        await this.ytMusicAPI.removeItemFromPlaylist(playlistId, originalItemDetails.videoId, originalItemDetails.playlistSetVideoId);
                        console.log(`Removed item ${originalItemDetails.name} from the playlist`);
                        UIHelper.removeMediaGridRow(originalItemDetails); // Remove the item from the UI immediately after removal
                    } catch (error) {
                        console.error(`Error removing item ${originalItemDetails.name} from the playlist:`, error);
                    }
                    i++;
                }
                const countOfItemsRemoved = selectedItems.length;
                const progressText = countOfItemsRemoved > 0 ? `All removals completed. Removed ${countOfItemsRemoved} items from the playlist.` : "No items were removed from the playlist.";
                this.setProgressText(progressText);
                console.log('All removals completed. Removed', countOfItemsRemoved, 'items');
            }
            catch (error) {
                console.error('Error removing selected items:', error);
                this.setProgressText("Error occurred while removing items. Check console for details.");
            }
            finally {
                this.afterActionsOnSelectedItems();
            }
        }
    }
    window.bridgeInstance = new Bridge(); // Expose the Bridge class to the global scope


    // Listen for messages from content script
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
    });
    window.postMessage({ type: 'BRIDGE_LOADED' }, '*');
    console.log('Bridge script loaded and ready to fetch variables');

    // Start fetching the auth token immediately after the bridge is loaded
    fetchAuthToken();

})();
