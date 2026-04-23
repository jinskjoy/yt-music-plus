# Coding Style Guidelines

Follow the coding style guidelines below when modifying or adding to the codebase.

## JavaScript (JS)
- **Structured Functions:** Write modular, properly structured functions with a single responsibility. Use clear naming conventions and include JSDoc comments where appropriate.
- **DOM Manipulation:** Avoid creating complex elements purely through JavaScript (e.g., long chains of `document.createElement`). If a structure can be defined in an HTML file or template, do so and inject it.
- **Event Handling:** Avoid inline event handlers in HTML. Use `addEventListener` in JS, and leverage event delegation when handling multiple similar child elements.

## Cascading Style Sheets (CSS)
- **No Inline CSS:** Avoid inline styles (e.g., `style="..."` or `element.style.property`) whenever possible. 
- **Class-Based State Management:** Manage dynamic styles and UI states by toggling predefined CSS classes in JavaScript (e.g., `.hidden`, `.expanded`, `.active`) rather than applying direct CSS property changes via JS.
- **Separation of Concerns:** Keep all styling declarations strictly inside `.css` files. Use descriptive and consistent class names.

## HTML
- **Semantic Structure:** Use semantic and accessible HTML elements to build layouts.
- **Templates Over Imperative UI:** Prefer static HTML templates for building user interfaces. It is easier to read and maintain an HTML file than tracking elements built entirely in a JavaScript function.
- **Clean Markup:** Do not use inline styles or inline JavaScript (`onclick="..."`) attributes within the HTML elements.
