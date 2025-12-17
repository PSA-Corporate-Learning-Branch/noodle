# Noodle Course Notes Demo

Noodle lets you embed lightweight note-taking fields into any web page, storing content in cookies rather than `localStorage`. This makes it ideal for environments where `localStorage` is unreliable—such as Moodle, which clears `localStorage` on logout. A floating **Noodle Notes** button gives users quick access to view, sort, and export all their notes as Markdown, HTML, or Word.

## How it works

* Each note block is a standard `<form class="noodle">` that must declare `data-courseid` and `data-sectionid`. These values determine the cookie key (`noodle_<sectionid>_<courseid>`) so notes stay unique per course section.
* Include a hidden `<input type="hidden" name="course-name" value="...">` inside every form. The value is stored with the notes and used for exports.
* `noodle.js` scans the page on `DOMContentLoaded`, restores note text from cookies, and handles both auto-save and manual save.
* **Auto-save:** Notes are automatically saved 2 seconds after you stop typing. Status shows "Typing..." while you type, then "Notes saved successfully at..." when saved.
* **Manual save:** You can also click the "Save Notes" button to save immediately.
* Every save records the timestamp and section order so the modal and exports can show notes in the correct sequence.
* A single "Noodle Notes" button is fixed to the bottom-left corner. Clicking it opens a modal showing all saved notes with options to:
  * **Sort by Recently Saved** - Shows newest notes first (default)
  * **Sort by Course Order** - Organizes notes by page number and section position across the entire course
  * **Export as Markdown** - Downloads a `.md` file with all notes
  * **Export as HTML** - Downloads a styled `.html` file with all notes
  * **Export as Word** - Downloads a `.docx` file compatible with Microsoft Word, LibreOffice, and Google Docs
  * **Delete All** - Clears all notes for the current course

## Course Order Sorting

The modal includes a "Sort: Course Order" toggle that organizes notes across multiple pages:

* **Page ordering:** Use the optional `data-page-order` attribute on forms to explicitly specify page sequence
  * Example: `data-page-order="1"` for intro page, `data-page-order="2"` for foundations page, etc.
  * All forms on the same page should use the same `data-page-order` value
  * Pages **with** `data-page-order` appear first, sorted numerically (1, 2, 3...)
  * Pages **without** `data-page-order` appear after, sorted alphabetically by URL
* **Section ordering:** Within each page, sections appear in document order (automatically tracked when notes are saved)

### Example

```html
<!-- Intro.html -->
<form class="noodle" data-courseid="101" data-sectionid="welcome" data-page-order="1">
  <!-- ... -->
</form>

<!-- Foundations.html -->
<form class="noodle" data-courseid="101" data-sectionid="basics" data-page-order="2">
  <!-- ... -->
</form>
<form class="noodle" data-courseid="101" data-sectionid="advanced" data-page-order="2">
  <!-- ... -->
</form>

<!-- Summary.html (no page order specified, will sort alphabetically) -->
<form class="noodle" data-courseid="101" data-sectionid="recap">
  <!-- ... -->
</form>
```

Result: Intro sections → Foundations sections (basics, then advanced) → Summary sections

## Adding note forms

### Basic accessible form structure

```html
<form class="noodle" data-courseid="86" data-sectionid="section1" data-sectiontitle="Introduction" data-page-order="1">
    <label for="notes-section1" class="sr-only">
        Notes for Section 1: Introduction
        <span class="sr-only">(saved locally in your browser)</span>
    </label>
    <textarea id="notes-section1"
              class="form-control"
              placeholder="Capture your notes…"
              maxlength="5000"
              rows="4"
              autocomplete="off"></textarea>
    <input type="hidden" name="course-name" value="B.C. Provincial Government Essentials">
    <button type="submit" class="btn btn-sm btn-primary">
        Save Notes
    </button>
</form>
```

### Accessibility features

* **Labels**: Each textarea has an associated `<label>` with a unique `id`. Use Bootstrap's `.sr-only` class to visually hide labels while keeping them accessible to screen readers.
* **ARIA descriptions**: The `aria-describedby` attribute links the textarea to helpful hint text.
* **Character limit**: The `maxlength="5000"` attribute enforces the character limit (managed by `noodle.js`).
* **Autocomplete**: Set to `"off"` since notes are unique content, not form data.
* **Button text**: Use "Save Notes" instead of just "Save" for clarity.
* **Status messages**: The script automatically creates a status element with `role="status"` and `aria-live="polite"` to announce save confirmations to screen readers.
* **Character counter**: Real-time character count with cookie usage percentage warnings at 75%, 90%, and 100% capacity.

### Form attributes

* **Required:** `data-sectionid` - Unique ID for each note section (e.g., `"intro"`, `"lesson-1"`). Each section persists independently.
* **Required:** `data-courseid` - Shared across all pages in a course to group notes together.
* **Optional:** `data-sectiontitle` - Human-readable name shown in the modal and exports.
* **Optional:** `data-page-order` - Numeric page order for "Course Order" sorting (e.g., `"1"`, `"2"`, `"3"`). All forms on the same page should share the same value.
* Include `noodle.js` at the bottom of any page that uses these forms (after the DOM content).

**Note:** Section order within each page is tracked automatically when notes are saved. The `data-page-order` attribute is optional but recommended for multi-page courses where you want explicit control over page sequence.

## Files

| File | Description |
| --- | --- |
| `test.html` | Sample course landing page with two noodle note forms. |
| `noodle.js` | Vanilla JS helper that manages cookies, status messages, cross-page exports (Markdown, HTML, Word), and the floating button. |
| `README.md` | This guide. |

## Security Concerns

- Notes are stored in cookies, so content is sent with every request to the host and visible to any script running on the same origin; avoid hosting on domains where other apps or untrusted scripts run.
- Cookies are scoped to `path=/`, meaning any page on the same host can read/overwrite note cookies; scope the path to your app (e.g., `/docs`) or add a per-site prefix/salt to reduce cross-app leakage.
- The `Secure` flag is added only when served over HTTPS; if accessed over HTTP, note cookies travel in cleartext. Serve over HTTPS exclusively or block initialization on non-HTTPS pages.
