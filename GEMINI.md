# Coding Style Guidelines

Follow the coding style guidelines below when modifying or adding to the codebase.

## Versioning
- **Sync Versions:** Always keep the `version` field in `package.json` and `manifest.json` in sync. When updating one, update the other to match.

## CSS and UI Namespacing
- **Prefix Everything:** All CSS classes, IDs, and custom attributes used in the extension's UI must be prefixed with `yt-music-plus-` (e.g., `.yt-music-plus-button`, `#yt-music-plus-main-container`).
- **Isolation:** This prefixing is mandatory to ensure the extension's styles and scripts do not conflict with YouTube Music's native elements or other extensions.
- **SCSS Usage:** Prefer SCSS for better organization and nesting of these prefixed styles.

## JavaScript (JS)
- **Structured Functions:** Write modular, properly structured functions with a single responsibility. Use clear naming conventions and include JSDoc comments where appropriate.
- **DOM Manipulation:** Avoid creating complex elements purely through JavaScript (e.g., long chains of `document.createElement`). If a structure can be defined in an HTML file or template, do so and inject it.
- **Event Handling:** Avoid inline event handlers in HTML. Use `addEventListener` in JS, and leverage event delegation when handling multiple similar child elements.
- **Constants Over Magic Literals:** Avoid using magic numbers or strings (e.g., timeout durations, retry counts, or regex patterns) directly in the code. All such literals should be defined in `utils/constants.js` and imported where needed.

## Cascading Style Sheets (CSS)
- **No Inline CSS:** Avoid inline styles (e.g., `style="..."` or `element.style.property`) whenever possible. 
- **Class-Based State Management:** Manage dynamic styles and UI states by toggling predefined CSS classes in JavaScript (e.g., `.hidden`, `.expanded`, `.active`) rather than applying direct CSS property changes via JS.
- **Separation of Concerns:** Keep all styling declarations strictly inside `.css` files. Use descriptive and consistent class names.

## HTML
- **Semantic Structure:** Use semantic and accessible HTML elements to build layouts.
- **Templates Over Imperative UI:** Prefer static HTML templates for building user interfaces. It is easier to read and maintain an HTML file than tracking elements built entirely in a JavaScript function.
- **Clean Markup:** Do not use inline styles or inline JavaScript (`onclick="..."`) attributes within the HTML elements.

## Documentation & Feature Tracking
- **Update Features List:** Always update `FEATURES.md` whenever a new feature is implemented or an existing feature's behavior is significantly changed. This ensures the features list remains a single source of truth for testing and documentation.

## UI & State Management
- **Minimized State:** When implementing "minimize" or "collapse" functionality, use a top-level CSS class (e.g., `.minimized`) on the container. Ensure that clicking the header or a dedicated toggle button restores the state using a centralized `toggleMinimize` method.
- **Event Delegation:** Prefer adding listeners to parent containers (like the popup header) for actions that should apply to the whole component state.

## Testing & Validation
- **Run Tests Before Commit:** Always run all automated tests (e.g., `npm test`) before making a commit to ensure no regressions are introduced.
