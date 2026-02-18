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
                'Authorization': this.authToken || '' // Include auth token if available
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
            const response = await this.makeGetRequest('/browse', { alt: 'json' });
            return this.parseEditablePlaylistsFromResponse(response);
        } catch (error) {
            console.error('Error fetching editable playlists:', error);
            throw error;
        }
    }

    async parseEditablePlaylistsFromResponse(data) {
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

                if (title && playlistId) {
                    playlists.push({
                        id: playlistId,
                        title: title,
                        subtitle: subtitle,
                        owner: owner
                    });
                }
            });
        } catch (error) {
            console.error("Error parsing playlists:", error);
            throw error;
        }

        return playlists;
    }
}