/**
 * Playlist - Represents a YouTube Music playlist
 */
export class Playlist {
  /**
   * @param {Object} params
   * @param {string} params.id - The playlist ID
   * @param {string} params.title - The title of the playlist
   * @param {string} [params.subtitle] - Subtitle (usually contains owner/track count)
   * @param {string} [params.owner] - The owner of the playlist
   * @param {string} [params.thumbnail] - URL to the playlist thumbnail
   * @param {boolean} [params.isEditable] - Whether the playlist is editable by the user
   */
  constructor({ id, title, subtitle = '', owner = '', thumbnail = '', isEditable = false }) {
    this.id = id;
    this.title = title;
    this.subtitle = subtitle;
    this.owner = owner;
    this.thumbnail = thumbnail;
    this.isEditable = isEditable;
  }

  /**
   * Creates a Playlist instance from a plain object
   * @param {Object} data 
   * @returns {Playlist}
   */
  static fromJSON(data) {
    return new Playlist(data);
  }
}
