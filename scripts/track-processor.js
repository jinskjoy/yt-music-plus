import { UIHelper } from '../utils/ui-helper.js';
import { Track } from './models/track.js';
import { CONSTANTS } from '../utils/constants.js';

/**
 * TrackProcessor - Handles the logic for processing tracks and finding replacements
 */
export class TrackProcessor {
  constructor(bridge) {
    this.bridge = bridge;
    this.ytMusicAPI = bridge.ytMusicAPI;
  }

  /**
   * Processes playlist items and finds replacements for unavailable tracks
   * @async
   * @param {Array<Track>} items - Playlist tracks to process
   */
  async processPlaylistItems(items) {
    this.bridge.session.start(items.length);
    const itemsToProcess = items;
    this.bridge.ui.clearPlaylistItemsContainer();

    let i = 1;
    for (const item of itemsToProcess) {
      if (!item.isLocal) {
        item.isSearching = !item.isGeneric;
      }
      item.searchCancelled = false;
      item.replacement = null;
      this.bridge.ui.addItem(item, CONSTANTS.API.BASE_URL, i++);
    }

    i = 1;
    for (const item of itemsToProcess) {
      this.bridge.session.updateProgress();
      if (item.isGeneric || item.isSkipped) {
        i++;
        continue;
      }

      if (this.bridge.session.isCancelled) {
        this.bridge.ui.setProgressText('Search cancelled.');
        break;
      }

      this.bridge.ui.setProgressText(this.bridge.session.progressText);

      try {
        const searchResult = await this.ytMusicAPI.searchMusic(item);
        const bestSearchResult = this.ytMusicAPI.getBestSearchResult(searchResult, item);
        item.replacement = bestSearchResult;
      } catch (error) {
        item.replacement = null;
      }
      
      item.isSearching = false;
      this.bridge.ui.updateItemRow(item, CONSTANTS.API.BASE_URL, i++);

      await this.bridge.sleep(CONSTANTS.API.TIMEOUT_DURATION_MS);
    }
    
    if (this.bridge.session.isCancelled) {
      for (let j = i; j <= itemsToProcess.length; j++) {
        if (!itemsToProcess[j - 1].isGeneric && !itemsToProcess[j - 1].isSkipped) {
          itemsToProcess[j - 1].isSearching = false;
          itemsToProcess[j - 1].searchCancelled = true;
          this.bridge.ui.updateItemRow(itemsToProcess[j - 1], CONSTANTS.API.BASE_URL, j);
        }
      }
    }

    this.bridge.session.stop();
    this.setFinalProgressText(itemsToProcess);
    UIHelper.updateCheckAllCheckbox();
  }

  /**
   * Sets final progress message after processing
   */
  setFinalProgressText(processedItems) {
    if (processedItems.length === 0) {
      this.bridge.ui.setProgressText('Processing complete. No items were processed.');
      return;
    }

    const searchedItems = processedItems.filter(item => !item.isSearching && !item.searchCancelled && !item.isGeneric && !item.isSkipped);
    const isLocalImport = processedItems.some(item => item.isLocal);
    let foundCountText;

    if (isLocalImport) {
      const replacedCount = searchedItems.filter(item => item.replacement).length;
      foundCountText = `Found replacements for ${replacedCount} of ${searchedItems.length} searched tracks.`;
    } else {
      foundCountText = `Found ${searchedItems.length} unavailable tracks and their replacements.`;
    }

    let progressText = this.bridge.cancelSearch ? `Search cancelled. ${foundCountText}` : `Processing complete. ${foundCountText}`;
    
    progressText += this.#getMatchQualityWarning(searchedItems);

    this.bridge.ui.setProgressText(progressText);
    if (!(isLocalImport && this.bridge.cancelSearch)) {
      document.getElementById('findLocalReplacementsBtn')?.classList.add('hidden');
    } else {
      document.getElementById('findLocalReplacementsBtn')?.classList.remove('hidden');
    }
  }

  /**
   * Appends match-quality warnings based on the number of good matches.
   * @private
   */
  #getMatchQualityWarning(items) {
    const replacements = items.filter(item => item.replacement);
    const countOfReplacements = replacements.length;
    if (countOfReplacements === 0) return '';

    const countOfGoodMatches = replacements.filter(item => item.replacement.isGoodMatch).length;

    if (countOfGoodMatches === 0) {
      return ` ${countOfReplacements} replacements found but no good matches. Please review carefully.`;
    } else if (countOfGoodMatches < countOfReplacements) {
      return ` ${countOfGoodMatches}/${countOfReplacements} are good matches. Some may need review.`;
    }
    return '';
  }

  /**
   * Finds and processes unavailable tracks in the playlist
   * @async
   */
  async findUnavailableTracks() {
    this.bridge.session.isCancelled = false;
    this.bridge.ui.clearPlaylistItemsContainer();
    this.bridge.ui.toggleSearchProgress(true, true);
    this.bridge.ui.setProgressText('Finding unavailable tracks...');

    try {
      const currentPlaylistId = this.bridge.currentSelectedPlaylist?.id || 
                                this.ytMusicAPI.getCurrentPlaylistIdFromURL();

      if (!currentPlaylistId) return;

      const items = await this.ytMusicAPI.getPlaylistItems(currentPlaylistId);
      const unavailableItems = items.filter(item => item.isGreyedOut);

      this.bridge.ui.setProgressText(`Found ${unavailableItems.length} unavailable tracks. Fetching replacements...`);

      if (unavailableItems.length > 0) {
        await this.processPlaylistItems(unavailableItems);
      }
    } catch (error) {
      this.bridge.ui.setProgressText('Error occurred while finding unavailable tracks.');
    } finally {
      this.bridge.ui.toggleSearchProgress(false);
    }
  }

  /**
   * Finds and processes video tracks in the playlist
   * @async
   */
  async findVideoTracks() {
    this.bridge.session.isCancelled = false;
    this.bridge.ui.clearPlaylistItemsContainer();
    this.bridge.ui.toggleSearchProgress(true, true);
    this.bridge.ui.setProgressText('Finding video tracks...');

    try {
      const currentPlaylistId = this.bridge.currentSelectedPlaylist?.id || 
                                this.ytMusicAPI.getCurrentPlaylistIdFromURL();

      if (!currentPlaylistId) return;

      const items = await this.ytMusicAPI.getPlaylistItems(currentPlaylistId);
      const videoTracks = items.filter(item => item.isVideo);

      this.bridge.ui.setProgressText(`Found ${videoTracks.length} video tracks. Fetching replacements...`);

      if (videoTracks.length === 0) return;

      let i = 1;
      for (const track of videoTracks) {
        track.isSearching = true;
        track.searchCancelled = false;
        track.replacement = null;
        this.bridge.ui.addItem(track, CONSTANTS.API.BASE_URL, i++);
      }

      i = 1;
      this.bridge.session.start(videoTracks.length);
      for (const track of videoTracks) {
        this.bridge.session.updateProgress();
        if (this.bridge.session.isCancelled) {
          this.bridge.ui.setProgressText('Search cancelled.');
          break;
        }

        try {
          const searchResult = await this.ytMusicAPI.searchMusic(track);
          const replacement = this.ytMusicAPI.getBestSearchResult(searchResult, track);
          track.replacement = replacement;
        } catch (error) {
          track.replacement = null;
        }
        
        track.isSearching = false;
        this.bridge.ui.updateItemRow(track, CONSTANTS.API.BASE_URL, i++);

        await this.bridge.sleep(CONSTANTS.API.TIMEOUT_DURATION_MS);
      }
      
      if (this.bridge.session.isCancelled) {
        for (let j = i; j <= videoTracks.length; j++) {
          videoTracks[j - 1].isSearching = false;
          videoTracks[j - 1].searchCancelled = true;
          this.bridge.ui.updateItemRow(videoTracks[j - 1], CONSTANTS.API.BASE_URL, j);
        }
      }

      this.bridge.session.stop();
      this.setVideoTrackProgressMessage(videoTracks);
      UIHelper.updateCheckAllCheckbox();
    } catch (error) {
      this.bridge.ui.setProgressText('Error occurred while finding video tracks.');
    } finally {
      this.bridge.ui.toggleSearchProgress(false);
    }
  }

  /**
   * Sets progress message for video track results
   */
  setVideoTrackProgressMessage(videoTracks) {
    const searchedTracks = videoTracks.filter(t => !t.isSearching && !t.searchCancelled);
    const prefix = this.bridge.session.isCancelled ? 'Search cancelled.' : 'Processing complete.';
    
    let progressText = searchedTracks.length > 0 
      ? `${prefix} Found ${searchedTracks.length} video tracks and their replacements.`
      : `${prefix} No video tracks were processed.`;

    if (searchedTracks.length > 0) {
      const countOfReplacements = searchedTracks.filter(t => t.replacement).length;
      if (countOfReplacements === 0) {
        progressText += ' No replacements found.';
      } else {
        progressText += this.#getMatchQualityWarning(searchedTracks);
      }
    }
    this.bridge.ui.setProgressText(progressText);
  }

  /**
   * Lists all tracks in the playlist
   * @async
   */
  async listAllTracks() {
    this.bridge.session.isCancelled = false;
    this.bridge.ui.clearPlaylistItemsContainer();
    document.querySelector('.items-grid-wrapper')?.classList.add('list-only-mode');
    this.bridge.ui.toggleSearchProgress(true, true);
    this.bridge.ui.setProgressText('Fetching all tracks...');

    try {
      const currentPlaylistId = this.bridge.currentSelectedPlaylist?.id || 
                                this.ytMusicAPI.getCurrentPlaylistIdFromURL();

      if (!currentPlaylistId) return;

      const items = await this.ytMusicAPI.getPlaylistItems(currentPlaylistId);
      this.bridge.ui.setProgressText(`Found ${items.length} tracks. Select tracks to remove.`);

      if (items.length === 0) return;

      let i = 1;
      for (const track of items) {
        track.isSearching = false;
        track.searchCancelled = false;
        track.replacement = null;
        this.bridge.ui.addItem(track, CONSTANTS.API.BASE_URL, i++);
      }

      document.getElementById('replaceSelectedBtn')?.classList.add('hidden');
      document.getElementById('addSelectedBtn')?.classList.add('hidden');
      document.getElementById('removeSelectedBtn')?.classList.remove('hidden');

      UIHelper.updateCheckAllCheckbox();
    } catch (error) {
      this.bridge.ui.setProgressText('Error occurred while fetching tracks.');
    } finally {
      this.bridge.ui.toggleSearchProgress(false);
    }
  }

  /**
   * Scans a local folder for media files
   * @async
   */
  async importFromFolder() {
    if (!('showDirectoryPicker' in window)) {
      this.bridge.ui.setProgressText('Error: Your browser does not support the File System Access API.');
      return;
    }

    try {
      const dirHandle = await window.showDirectoryPicker();
      this.bridge.ui.toggleSearchProgress(true, false);
      this.bridge.ui.setProgressText('Scanning folder for media files...');

      const mediaExtensions = CONSTANTS.MEDIA.EXTENSIONS;
      const files = [];

      await TrackProcessor.#getFilesRecursively(dirHandle, mediaExtensions, files);

      this.bridge.ui.setProgressText(`Found ${files.length} media files. Displaying list...`);
      this.bridge.ui.clearPlaylistItemsContainer();

      const localTracks = files.map(file => {
        const rawName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const name = rawName.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
        const isGeneric = name.length < 3 || CONSTANTS.REGEX.GENERIC_NAME.test(name);
        return new Track({
          name: name,
          artists: [],
          album: '',
          isLocal: true,
          localFile: file,
          isSearching: !isGeneric,
          isGeneric: isGeneric
        });
      }).sort((a, b) => (a.isGeneric === b.isGeneric ? 0 : a.isGeneric ? -1 : 1));

      this.bridge.localTracks = localTracks;

      let i = 1;
      localTracks.forEach(track => this.bridge.ui.addItem(track, CONSTANTS.API.BASE_URL, i++));

      if (localTracks.length > 0) {
        let progressMsg = `Displayed ${localTracks.length} tracks.`;
        const genericCount = localTracks.filter(t => t.isGeneric).length;
        if (genericCount > 0) progressMsg += ` (${genericCount} generic names ignored).`;
        progressMsg += ` Click "Start Search" to search for the checked tracks on YouTube Music.`;
        this.bridge.ui.setProgressText(progressMsg);
        this.bridge.updateImportButtonVisibility();
        UIHelper.updateCheckAllCheckbox();
      } else {
        this.bridge.ui.setProgressText('No media files found in the selected folder.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        this.bridge.ui.setProgressText('Error accessing folder.');
      } else {
        this.bridge.ui.setProgressText('Folder selection cancelled.');
      }
    } finally {
      this.bridge.ui.toggleSearchProgress(false);
    }
  }

  /**
   * Reads a track list from a text file
   * @async
   */
  async importFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    this.bridge.ui.toggleSearchProgress(true, false);
    this.bridge.ui.setProgressText('Reading file...');

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);

      this.bridge.ui.setProgressText(`Found ${lines.length} tracks in file. Displaying list...`);
      this.bridge.ui.clearPlaylistItemsContainer();

      const localTracks = lines.map(line => {
        const name = line.trim();
        const isGeneric = name.length < 3 || CONSTANTS.REGEX.GENERIC_NAME.test(name);
        return new Track({
          name: name,
          artists: [],
          album: '',
          isLocal: true,
          isSearching: !isGeneric,
          isGeneric: isGeneric
        });
      }).sort((a, b) => (a.isGeneric === b.isGeneric ? 0 : a.isGeneric ? -1 : 1));

      this.bridge.localTracks = localTracks;

      let i = 1;
      localTracks.forEach(track => this.bridge.ui.addItem(track, CONSTANTS.API.BASE_URL, i++));

      if (localTracks.length > 0) {
        let progressMsg = `Displayed ${localTracks.length} tracks.`;
        const genericCount = localTracks.filter(t => t.isGeneric).length;
        if (genericCount > 0) progressMsg += ` (${genericCount} generic names ignored).`;
        progressMsg += ` Click "Start Search" to search for the checked tracks on YouTube Music.`;
        this.bridge.ui.setProgressText(progressMsg);
        this.bridge.updateImportButtonVisibility();
        UIHelper.updateCheckAllCheckbox();
      } else {
        this.bridge.ui.setProgressText('No valid tracks found in the file.');
      }
    } catch (error) {
      this.bridge.ui.setProgressText('Error reading file.');
    } finally {
      this.bridge.ui.toggleSearchProgress(false);
      event.target.value = ''; // Reset input
    }
  }

  /**
   * Helper to recursively find media files in a directory
   * @private
   */
  static async #getFilesRecursively(directoryHandle, extensions, files) {
    for await (const entry of directoryHandle.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        if (extensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
          files.push(file);
        }
      } else if (entry.kind === 'directory') {
        await TrackProcessor.#getFilesRecursively(entry, extensions, files);
      }
    }
  }
}
