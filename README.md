# <img src="images/yt-music-plus-logo-circle.png" width="40"> YouTube Music +


A browser extension to keep your YouTube Music playlists fresh, clean, and more.

## Table of Contents

- [Introduction](#introduction)
- [The Problem](#the-problem)
- [Features](#features)
- [How to Use](#how-to-use)
- [Contributing](#contributing)
- [License](#license)

## Introduction

This extension enhances your YouTube Music experience by providing powerful tools to manage your playlists. Clean up unavailable tracks, replace music videos with official audio, import your local music library, and more.

## The Problem

Managing large YouTube Music playlists can be a chore. Songs become unavailable, you might have added low-quality music videos instead of official audio, or you want to import a large list of songs from another source. Manually fixing these issues is a tedious process. This extension automates these tasks for you.

## Features

- **Find Unavailable Tracks:** Automatically scan your playlists for "greyed out" unavailable tracks and find suitable replacements.
- **Find Video Tracks:** Scan your playlists for video tracks and find official audio replacements to improve audio quality and consistency.
- **Import Local Music:** Scan a local folder of music files or import a list from a text file. The extension will search for these tracks on YouTube Music, allowing you to add them to any of your playlists.
- **List All Tracks:** View all tracks in a playlist in a simple list, making it easy to select and remove multiple tracks at once.
- **Flexible Actions:** After finding replacements, you can choose to replace the original tracks, add the new tracks alongside the old ones, or just remove the original tracks.

## How to Use

The core functionality is cleaning up playlists. Here's how it works:

1.  **Open a Playlist:** Navigate to any of your playlists on music.youtube.com.
2.  **Open the Extension:** Click on the "YouTube Music +" button that appears in the header or in the navigation bar. It may take a couple of seconds for the buttons to show up as the extension initializes.

    ![Screenshot of opening the extension](/images/1.%20Extension%20buttons.png)
3. **Select a playlist:** From the list of playlists that you have access to edit, choose one. If you are already on a playlist page, it will be auto-selected.
    ![Screenshot of selecting a playlist](/images/2.%20Editable%20playlists.png)


4.  **Scan for Tracks:** Click "Find Unavailable Tracks" to find greyed-out songs, or "Find Video Tracks" to find music videos. The extension will search for replacements.

    ![Screenshot of scanning a playlist](/images/3.%20Find%20and%20replace.png)

5.  **Review and Act:** Review the found replacements. You can uncheck any you don't want. Then, click "Replace Selected" to swap the old tracks with the new ones.

    ![Screenshot of replacing tracks](/images/4.%20Replacing.png)

6. **Other Options:** You can also choose to only "Remove Selected" tracks without adding replacements, or "Add Selected" to add the new tracks without removing the old ones.

7. **Important Reminder:** YouTube Music may try to refresh the page when it detects playlist changes. You must cancel the page reload prompt for the extension to complete its work.

### Other Features

- **Importing Music:** On the playlist details screen, click "Import from Folder" or "Import from File".
  - **From Folder:** Select a folder on your computer. The extension will scan it for audio files.
  - **From File:** Select a `.txt` file where each line is a song title (e.g., "Artist - Song Title").
  - After scanning, you can search for the tracks on YouTube Music and add them to your selected playlist.

- **Bulk Deleting:** Click "List All Tracks" to see every song in the playlist. Check the ones you want to remove and click "Remove Selected".

## Contributing

Contributions are welcome! If you have any ideas, suggestions, or find any bugs, please open an issue or submit a pull request.

### How to Contribute

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add some feature'`).
5.  Push to the branch (`git push origin feature/your-feature`).
6.  Open a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
