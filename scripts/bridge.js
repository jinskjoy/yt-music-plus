/**
 * Bridge Script - Runs in page context to access window variables
 * This script extracts window.ytconfig and sends it to the content script via postMessage
 * Periodically fetches the config to ensure fresh data
 */
import { YTMusicAPI } from './yt-music-api.js';
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
                headers = request.headers;

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
        }

        setAuthToken(token) {
            console.log("Setting auth token in bridge:", token);
            this.ytMusicAPI.setAuthToken(token);
            this.findPlalistsThatNeedRefreshing();
        }
        async findPlalistsThatNeedRefreshing() {
            try {
                const playlists = await this.ytMusicAPI.getEditablePlaylists();
                printf("Fetched playlists in bridge:", playlists);
                const now = Date.now();
            }
            catch (error) {
                console.error('Error fetching playlists in bridge:', error);
            }
        }
    }
    window.bridgeInstance = new Bridge(); // Expose the Bridge class to the global scope


    // Listen for fetch requests from content script
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;

        if (event.data.type === 'FETCH_VARIABLE_REQUEST' && event.data.variableName) {
            fetchVariable(event.data.variableName, event.data.requestedBy);
        }
    });
    window.postMessage({ type: 'BRIDGE_LOADED' }, '*');
    console.log('Bridge script loaded and ready to fetch variables');
    
    // Start fetching the auth token immediately after the bridge is loaded
    fetchAuthToken();
    
})();
