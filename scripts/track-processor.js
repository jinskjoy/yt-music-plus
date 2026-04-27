import { UIHelper } from '../utils/ui-helper.js';
import { Track } from './models/track.js';
import { CONSTANTS } from '../utils/constants.js';
import { MESSAGES } from '../utils/ui-messages.js';
import { TextSimilarity } from '../utils/utils.js';

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
        this.bridge.ui.setProgressText(MESSAGES.SEARCH.CANCELLING);
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

    let progressText = this.bridge.session.isCancelled ? `Search cancelled. ${foundCountText}` : `Processing complete. ${foundCountText}`;
    
    progressText += this.#getMatchQualityWarning(searchedItems);

    this.bridge.ui.setProgressText(progressText);
    if (!(isLocalImport && this.bridge.session.isCancelled)) {
      document.getElementById(CONSTANTS.UI.BUTTON_IDS.FIND_LOCAL_REPLACEMENTS)?.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
    } else {
      document.getElementById(CONSTANTS.UI.BUTTON_IDS.FIND_LOCAL_REPLACEMENTS)?.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
    }
  }

  /**
   * Appends match-quality warnings based on the number of good matches.
   * @private
   */
  #getMatchQualityWarning(items) {
    const replacements = items.filter(item => item.replacement);
    const countOfReplacements = replacements.length;
    if (countOfReplacements === 0) return ` ${MESSAGES.RESULTS.NO_REPLACEMENTS_FOUND}`;

    const countOfGoodMatches = replacements.filter(item => item.replacement.isGoodMatch).length;

    if (countOfGoodMatches === 0) {
      return MESSAGES.RESULTS.MATCH_QUALITY_WARNING(`${countOfReplacements} replacements found but no good matches`);
    } else if (countOfGoodMatches < countOfReplacements) {
      return MESSAGES.RESULTS.MATCH_QUALITY_WARNING(`${countOfGoodMatches}/${countOfReplacements} are good matches`);
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
    this.bridge.ui.resetActionButtonsForPlaylist(this.bridge.currentSelectedPlaylist);
    this.bridge.ui.setTargetContainerVisibility(false);
    this.bridge.ui.toggleSearchProgress(true, true);
    this.bridge.ui.setProgressText(MESSAGES.SEARCH.FINDING_UNAVAILABLE);

    try {
      const currentPlaylistId = this.bridge.currentSelectedPlaylist?.id || 
                                this.ytMusicAPI.getCurrentPlaylistIdFromURL();

      if (!currentPlaylistId) return;

      const items = await this.ytMusicAPI.getPlaylistItems(currentPlaylistId);
      
      if (this.bridge.session.isCancelled) return;
      if (items.length === 0) {
        this.bridge.ui.setProgressText(MESSAGES.RESULTS.NO_TRACKS_FOUND);
        return;
      }

      const unavailableItems = items.filter(item => item.isGreyedOut);

      if (unavailableItems.length === 0) {
        this.bridge.ui.setProgressText(MESSAGES.RESULTS.NO_UNAVAILABLE_FOUND);
        return;
      }

      this.bridge.ui.setProgressText(MESSAGES.RESULTS.FOUND_TRACKS(unavailableItems.length));
      await this.processPlaylistItems(unavailableItems);
    } catch (error) {
      this.bridge.ui.setProgressText(MESSAGES.ACTIONS.ERROR_OCCURRED('finding unavailable tracks'));
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
     this.bridge.ui.resetActionButtonsForPlaylist(this.bridge.currentSelectedPlaylist);
     this.bridge.ui.setTargetContainerVisibility(false);
     this.bridge.ui.toggleSearchProgress(true, true);
     this.bridge.ui.setProgressText(MESSAGES.SEARCH.FINDING_VIDEO_TRACKS);

     try {
       const currentPlaylistId = this.bridge.currentSelectedPlaylist?.id || 
                                 this.ytMusicAPI.getCurrentPlaylistIdFromURL();

       if (!currentPlaylistId) return;

       const items = await this.ytMusicAPI.getPlaylistItems(currentPlaylistId);

       if (this.bridge.session.isCancelled) return;
       if (items.length === 0) {
         this.bridge.ui.setProgressText(MESSAGES.RESULTS.NO_TRACKS_FOUND);
         return;
       }

       const videoTracks = items.filter(item => item.isVideo);

       if (videoTracks.length === 0) {
         this.bridge.ui.setProgressText(MESSAGES.RESULTS.NO_VIDEO_TRACKS_FOUND);
         return;
       }

       this.bridge.ui.setProgressText(MESSAGES.RESULTS.FOUND_TRACKS(videoTracks.length));

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
           this.bridge.ui.setProgressText(MESSAGES.SEARCH.CANCELLING);
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
       this.bridge.ui.setProgressText(MESSAGES.ACTIONS.ERROR_OCCURRED('finding video tracks'));
     } finally {
       this.bridge.ui.toggleSearchProgress(false);
     }
   }

  /**
   * Finds and groups duplicate tracks in the playlist
   * @async
   */
  async findDuplicateTracks() {
    this.bridge.session.isCancelled = false;
    this.bridge.ui.clearPlaylistItemsContainer();
    this.bridge.ui.resetActionButtonsForPlaylist(this.bridge.currentSelectedPlaylist);
    this.bridge.ui.setTargetContainerVisibility(false);
    this.bridge.ui.setDuplicateTrackMode(true);
    this.bridge.ui.toggleSearchProgress(true, true);
    this.bridge.ui.setProgressText(MESSAGES.SEARCH.FINDING_DUPLICATES);

    try {
      const currentPlaylistId = this.bridge.currentSelectedPlaylist?.id || 
                                this.ytMusicAPI.getCurrentPlaylistIdFromURL();

      if (!currentPlaylistId) return;

      const items = await this.ytMusicAPI.getPlaylistItems(currentPlaylistId);
      
      if (this.bridge.session.isCancelled) return;
      if (items.length === 0) {
        this.bridge.ui.setProgressText(MESSAGES.RESULTS.NO_TRACKS_FOUND);
        return;
      }

      // Group tracks by duplicate criteria
      const groups = this.#groupTracksByDuplicates(items);
      const duplicateGroups = groups.filter(group => group.length > 1);

      if (duplicateGroups.length === 0) {
        this.bridge.ui.setProgressText(MESSAGES.RESULTS.NO_DUPLICATES_FOUND);
        return;
      }

      const totalDuplicateTracks = duplicateGroups.reduce((acc, g) => acc + g.length, 0);
      this.bridge.ui.setProgressText(MESSAGES.RESULTS.FOUND_DUPLICATE_GROUPS(duplicateGroups.length, totalDuplicateTracks));

      let i = 1;
      duplicateGroups.forEach((group, groupIndex) => {
        // By default the first audio track (if present) should be selected to keep
        const audioTrackIndex = group.findIndex(t => !t.isVideo);
        const keepIndex = audioTrackIndex !== -1 ? audioTrackIndex : 0;

        group.forEach((track, trackIndex) => {
          const isToKeep = (trackIndex === keepIndex);
          track.isSearching = false;
          track.searchCancelled = false;
          track.replacement = null;
          
          // Pass the isChecked state to addItem
          const gridRow = this.bridge.ui.addItem(track, CONSTANTS.API.BASE_URL, i++, {
            isStart: trackIndex === 0,
            indexInGroup: trackIndex,
            groupIndex
          });
          
          // Set the checkbox state explicitly
          const checkbox = gridRow.querySelector(`.${CONSTANTS.UI.CLASSES.ITEM_CHECKBOX}`);
          if (checkbox) {
            checkbox.checked = isToKeep;
          }
        });
      });

      this.bridge.ui.updateActionButtonsVisibility({
        replace: false,
        add: false,
        remove: false,
        keep: true
      });

      UIHelper.updateCheckAllCheckbox();
    } catch (error) {
      console.error('Duplicate check error:', error);
      this.bridge.ui.setProgressText(MESSAGES.ACTIONS.ERROR_OCCURRED('finding duplicate tracks'));
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
    this.bridge.ui.setTargetContainerVisibility(false);
    this.bridge.ui.setListOnlyMode(true);
    this.bridge.ui.toggleSearchProgress(true, true);
    this.bridge.ui.setProgressText(MESSAGES.SEARCH.FETCHING_ALL_TRACKS);

    try {
      const currentPlaylistId = this.bridge.currentSelectedPlaylist?.id || 
                                this.ytMusicAPI.getCurrentPlaylistIdFromURL();

      if (!currentPlaylistId) return;

      const items = await this.ytMusicAPI.getPlaylistItems(currentPlaylistId);
      
      // Race condition check: Verify if we are still on the same playlist
      if (this.bridge.currentSelectedPlaylist?.id !== currentPlaylistId) {
        return;
      }

      if (this.bridge.session.isCancelled) return;
      if (items.length === 0) {
        this.bridge.ui.setProgressText(MESSAGES.RESULTS.NO_TRACKS_FOUND);
        return;
      }

      this.bridge.ui.setProgressText(MESSAGES.RESULTS.FOUND_TRACKS(items.length));

      let i = 1;
      for (const track of items) {
        track.isSearching = false;
        track.searchCancelled = false;
        track.replacement = null;
        this.bridge.ui.addItem(track, CONSTANTS.API.BASE_URL, i++);
      }

      this.bridge.ui.updateActionButtonsVisibility({
        replace: false,
        add: false,
        remove: true
      });

      UIHelper.updateCheckAllCheckbox();
    } catch (error) {
      this.bridge.ui.setProgressText(MESSAGES.ACTIONS.ERROR_OCCURRED('fetching tracks'));
    } finally {
      this.bridge.ui.toggleSearchProgress(false);
    }
  }

  /**
   * Removes unmarked tracks from duplicate groups
   * @async
   */
  async keepOnlySelected() {
    const allGroupRows = Array.from(document.querySelectorAll(`.${CONSTANTS.UI.CLASSES.GRID_ROW}.${CONSTANTS.UI.CLASSES.DUPLICATE_GROUP_ROW}, .${CONSTANTS.UI.CLASSES.GRID_ROW}.${CONSTANTS.UI.CLASSES.ALT_DUPLICATE_GROUP_ROW}`));
    
    // Separate into items to keep and items to remove
    const itemsToRemove = [];
    const itemsToKeep = [];

    allGroupRows.forEach(row => {
      const checkbox = row.querySelector(`.${CONSTANTS.UI.CLASSES.ITEM_CHECKBOX}`);
      const originalMedia = JSON.parse(row.dataset.originalMedia || '{}');
      
      const item = {
        videoId: originalMedia.videoId,
        setVideoId: originalMedia.playlistSetVideoId,
        originalMedia
      };

      if (checkbox && !checkbox.checked && item.videoId && item.setVideoId) {
        itemsToRemove.push(item);
      } else if (item.videoId) {
        itemsToKeep.push(item);
      }
    });

    if (itemsToRemove.length === 0) return;

    if (!confirm(MESSAGES.ACTIONS.KEEP_SELECTED_CONFIRM(itemsToKeep.length, itemsToRemove.length))) {
      return;
    }

    try {
      this.bridge.beforeActionsOnSelectedItems();
      this.bridge.ui.setProgressText(MESSAGES.ACTIONS.REMOVING_SELECTED);

      const playlistId = this.bridge.currentSelectedPlaylist?.id || 
                        this.ytMusicAPI.getCurrentPlaylistIdFromURL();

      if (!playlistId) return;

      // Filter out any duplicates within itemsToRemove just in case (should be unique due to setVideoId)
      const uniqueItemsToRemove = Array.from(new Map(itemsToRemove.map(item => [item.setVideoId, item])).values());
      const success = await this.ytMusicAPI.removeItemsFromPlaylist(playlistId, uniqueItemsToRemove);

      if (success) {
        // Successfully removed from playlist, now remove from UI
        uniqueItemsToRemove.forEach(item => {
          UIHelper.removeMediaGridRow(item.originalMedia);
        });
        
        this.bridge.ui.setProgressText(MESSAGES.ACTIONS.KEEP_COMPLETE(uniqueItemsToRemove.length));
        
        // Wait a moment for UI cleanup then refresh the duplicate list
        setTimeout(() => {
          this.findDuplicateTracks();
        }, CONSTANTS.UI.UI_UPDATE_DELAY_MS);
      } else {
        this.bridge.ui.setProgressText(MESSAGES.ACTIONS.ERROR_OCCURRED('removing duplicates'));
      }
    } catch (error) {
      console.error('Error in keepOnlySelected:', error);
      this.bridge.ui.setProgressText(MESSAGES.ACTIONS.ERROR_OCCURRED('removing duplicates'));
    } finally {
      await this.bridge.afterActionsOnSelectedItems(true);
    }
  }

  /**
   * Groups tracks by video ID or title similarity
   * @private
   */
  #groupTracksByDuplicates(tracks) {
    const STRICT_THRESHOLD = 0.9;
    const groups = [];
    const processedIndices = new Set();

    for (let i = 0; i < tracks.length; i++) {
      if (processedIndices.has(i)) continue;

      const group = [tracks[i]];
      processedIndices.add(i);

      for (let j = i + 1; j < tracks.length; j++) {
        if (processedIndices.has(j)) continue;

        const t1 = tracks[i];
        const t2 = tracks[j];

        // Exact ID match is fast and conclusive
        const isSameId = t1.videoId && t2.videoId && t1.videoId === t2.videoId;

        // Only perform expensive fuzzy title matching if IDs aren't an exact match
        const isSimilarTitle = isSameId || TextSimilarity.isGoodMatch(t1.name, t2.name, STRICT_THRESHOLD);

        if (isSimilarTitle) {
          group.push(tracks[j]);
          processedIndices.add(j);
        }
      }
      groups.push(group);
    }
    return groups;
  }  /**
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

      this.bridge.ui.setProgressText(MESSAGES.IMPORT.READING_FILES(files.length));
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
        const genericCount = localTracks.filter(t => t.isGeneric).length;
        let progressMsg = MESSAGES.RESULTS.FOUND_TRACKS(localTracks.length);
        if (genericCount > 0) progressMsg += ` (${genericCount} generic names ignored).`;
        progressMsg += ` Click "Start Search" to search for the checked tracks on YouTube Music.`;
        this.bridge.ui.setProgressText(progressMsg);
        this.bridge.ui.updateImportButtonVisibility(this.bridge.currentSelectedPlaylist);
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

      this.bridge.ui.setProgressText(MESSAGES.IMPORT.READING_FILES(lines.length));
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
        const genericCount = localTracks.filter(t => t.isGeneric).length;
        let progressMsg = MESSAGES.RESULTS.FOUND_TRACKS(localTracks.length);
        if (genericCount > 0) progressMsg += ` (${genericCount} generic names ignored).`;
        progressMsg += ` Click "Start Search" to search for the checked tracks on YouTube Music.`;
        this.bridge.ui.setProgressText(progressMsg);
        this.bridge.ui.updateImportButtonVisibility(this.bridge.currentSelectedPlaylist);
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
