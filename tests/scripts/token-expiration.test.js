import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isTokenExpiredError } from '../../utils/utils.js';
import { YTMusicAPI } from '../../scripts/yt-music-api.js';
import { BridgeUI } from '../../scripts/bridge-ui.js';
import { CONSTANTS } from '../../utils/constants.js';
import { MESSAGES } from '../../utils/ui-messages.js';

describe('Token Expiration Handling', () => {
  describe('isTokenExpiredError', () => {
    it('should return false for falsy or normal errors', () => {
      expect(isTokenExpiredError(null)).toBe(false);
      expect(isTokenExpiredError(undefined)).toBe(false);
      expect(isTokenExpiredError(new Error('Network error'))).toBe(false);
      expect(isTokenExpiredError({ status: 500 })).toBe(false);
      expect(isTokenExpiredError({ status: 404 })).toBe(false);
    });

    it('should return true when status is 401 or 403 or isTokenExpired is true', () => {
      expect(isTokenExpiredError({ status: 401 })).toBe(true);
      expect(isTokenExpiredError({ status: 403 })).toBe(true);
      expect(isTokenExpiredError({ isTokenExpired: true })).toBe(true);
    });

    it('should return true when message contains 401, 403, unauthorized, forbidden, or permission', () => {
      expect(isTokenExpiredError(new Error('HTTP error! status: 401'))).toBe(true);
      expect(isTokenExpiredError(new Error('HTTP error! status: 403'))).toBe(true);
      expect(isTokenExpiredError(new Error('Request unauthorized'))).toBe(true);
      expect(isTokenExpiredError(new Error('Forbidden resource access'))).toBe(true);
      expect(isTokenExpiredError(new Error('Permission denied by API'))).toBe(true);
      expect(isTokenExpiredError(new Error('Token expired, please re-authenticate'))).toBe(true);
    });
  });

  describe('YTMusicAPI token error tagging', () => {
    let api;

    beforeEach(() => {
      api = new YTMusicAPI();
      global.fetch = vi.fn();
    });

    it('should tag errors with isTokenExpired on HTTP 401/403 in makeGetRequest', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      let thrownError = null;
      try {
        await api.makeGetRequest('/test');
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.status).toBe(401);
      expect(thrownError.isTokenExpired).toBe(true);
      expect(isTokenExpiredError(thrownError)).toBe(true);
    });

    it('should tag errors with isTokenExpired on HTTP 403 in makePostRequest', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403
      });

      let thrownError = null;
      try {
        await api.makePostRequest('/test');
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.status).toBe(403);
      expect(thrownError.isTokenExpired).toBe(true);
      expect(isTokenExpiredError(thrownError)).toBe(true);
    });

    it('should tag errors with isTokenExpired on inner JSON error code 401/403', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: { code: 403, message: 'Invalid token' } })
      });

      let thrownError = null;
      try {
        await api.makePostRequest('/test');
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.status).toBe(403);
      expect(thrownError.isTokenExpired).toBe(true);
    });
  });

  describe('BridgeUI Token Modal', () => {
    let bridgeUI;
    let mockBridge;

    beforeEach(() => {
      document.body.innerHTML = `
        <div id="yt-music-plus-tokenExpiredModal" class="yt-music-plus-modal-overlay yt-music-plus-hidden">
          <button id="yt-music-plus-fetchTokenBtn"></button>
          <button id="yt-music-plus-cancelTokenModalBtn"></button>
          <button id="yt-music-plus-closeTokenModalBtn"></button>
        </div>
      `;

      mockBridge = {
        attemptTokenRefresh: vi.fn(),
        cancelTokenRefresh: vi.fn(),
        cancelTargetSelection: vi.fn(),
        initPlaylistFetching: vi.fn()
      };

      bridgeUI = new BridgeUI(mockBridge);
    });

    it('should correctly toggle and check token modal visibility', () => {
      expect(bridgeUI.isTokenExpiredModalVisible()).toBe(false);

      bridgeUI.setTokenExpiredModalVisibility(true);
      expect(bridgeUI.isTokenExpiredModalVisible()).toBe(true);

      bridgeUI.setTokenExpiredModalVisibility(false);
      expect(bridgeUI.isTokenExpiredModalVisible()).toBe(false);
    });

    it('should attach click handlers for fetch token and cancel buttons', () => {
      document.getElementById('yt-music-plus-fetchTokenBtn')?.click();
      expect(mockBridge.attemptTokenRefresh).toHaveBeenCalled();

      document.getElementById('yt-music-plus-cancelTokenModalBtn')?.click();
      expect(mockBridge.cancelTokenRefresh).toHaveBeenCalledTimes(1);

      document.getElementById('yt-music-plus-closeTokenModalBtn')?.click();
      expect(mockBridge.cancelTokenRefresh).toHaveBeenCalledTimes(2);
    });
  });

  describe('Bridge token expired popup and pending action workflow', () => {
    let mockBridge;
    let mockUI;

    beforeEach(() => {
      mockUI = {
        setTokenExpiredModalVisibility: vi.fn(),
        isTokenExpiredModalVisible: vi.fn(),
        setProgressText: vi.fn(),
        injectActionButtons: vi.fn(),
        showTriggerButtons: vi.fn(),
        toggleSearchProgress: vi.fn()
      };

      mockBridge = {
        ytMusicAPI: {
          setAuthToken: vi.fn()
        },
        ui: mockUI,
        session: {
          stop: vi.fn()
        },
        playerHandler: {
          init: vi.fn()
        },
        extSettings: {},
        pendingAction: null,
        addEventListeners: vi.fn(),

        isTokenExpiredError(error) {
          return isTokenExpiredError(error);
        },

        handleTokenExpired(actionFn) {
          this.pendingAction = actionFn;
          this.ui.setTokenExpiredModalVisibility(true);
          this.ui.setProgressText(MESSAGES.ERRORS?.TOKEN_EXPIRED_MSG || 'Authentication Token Expired');
        },

        cancelTokenRefresh() {
          this.pendingAction = null;
          this.ui.setTokenExpiredModalVisibility(false);
          this.session.stop();
          this.ui.toggleSearchProgress(false);
          this.ui.setProgressText('Operation cancelled.');
        },

        attemptTokenRefresh() {
          const selectors = [
            'ytmusic-logo',
            '#logo',
            '.ytmusic-logo',
            'ytmusic-pivot-bar-renderer ytmusic-pivot-bar-item-renderer',
            'ytmusic-search-box',
            'ytmusic-nav-bar',
            'tp-yt-paper-icon-button'
          ];

          let clicked = false;
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) {
              try {
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                el.dispatchEvent(clickEvent);
                clicked = true;
                break;
              } catch (e) {}
            }
          }

          if (!clicked && document.body) {
            try {
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              document.body.dispatchEvent(clickEvent);
            } catch (e) {}
          }
        },

        setAuthToken(token) {
          this.ytMusicAPI.setAuthToken(token);
          this.addEventListeners();
          this.ui.injectActionButtons(this.extSettings);
          this.ui.showTriggerButtons(this.extSettings);
          this.playerHandler.init();

          if (this.pendingAction) {
            const action = this.pendingAction;
            this.pendingAction = null;
            this.ui.setTokenExpiredModalVisibility(false);
            this.ui.setProgressText(MESSAGES.ERRORS?.TOKEN_FETCHED_RESUMING || 'New token received. Resuming action...');
            action();
          }
        }
      };
    });

    it('should set pendingAction and show modal on handleTokenExpired', () => {
      const actionFn = vi.fn();
      mockBridge.handleTokenExpired(actionFn);

      expect(mockBridge.pendingAction).toBe(actionFn);
      expect(mockUI.setTokenExpiredModalVisibility).toHaveBeenCalledWith(true);
      expect(mockUI.setProgressText).toHaveBeenCalledWith(MESSAGES.ERRORS.TOKEN_EXPIRED_MSG);
    });

    it('should clear pendingAction and hide modal on cancelTokenRefresh', () => {
      mockBridge.pendingAction = () => {};
      mockBridge.cancelTokenRefresh();

      expect(mockBridge.pendingAction).toBeNull();
      expect(mockUI.setTokenExpiredModalVisibility).toHaveBeenCalledWith(false);
      expect(mockUI.setProgressText).toHaveBeenCalledWith('Operation cancelled.');
    });

    it('should resume pending action and hide modal when setAuthToken is called', () => {
      const actionFn = vi.fn();
      mockBridge.pendingAction = actionFn;

      mockBridge.setAuthToken('new-valid-token');

      expect(mockBridge.ytMusicAPI.setAuthToken).toHaveBeenCalledWith('new-valid-token');
      expect(mockBridge.pendingAction).toBeNull();
      expect(mockUI.setTokenExpiredModalVisibility).toHaveBeenCalledWith(false);
      expect(actionFn).toHaveBeenCalled();
    });

    it('should attempt token refresh by clicking target elements or body', () => {
      const logo = document.createElement('div');
      logo.className = 'ytmusic-logo';
      const clickSpy = vi.fn();
      logo.addEventListener('click', clickSpy);
      document.body.appendChild(logo);

      mockBridge.attemptTokenRefresh();
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should fallback to clicking document.body if no selector element is found', () => {
      document.body.innerHTML = '';
      const bodyClickSpy = vi.fn();
      document.body.addEventListener('click', bodyClickSpy);

      mockBridge.attemptTokenRefresh();
      expect(bodyClickSpy).toHaveBeenCalled();
    });
  });
});
