# Noodle Course Notes Demo

A static example page (`test.html`) demonstrates how to embed lightweight learner note fields inside course content (e.g., Moodle). Every note form is stored entirely in the browser via cookies so learners keep their notes even if Moodle clears `localStorage` on logout. A floating **Export Notes** button lets them download all notes for the current course as a Markdown file.

## How it works

* Each note block is a standard `<form class="noodle">` that must declare `data-courseid` and `data-sectionid`. These values determine the cookie key (`noodle_<sectionid>_<courseid>`) so notes stay unique per course section.
* Include a hidden `<input type="hidden" name="course-name" value="...">` inside every form. The value is stored with the notes and used for exports.
* `noodle.js` scans the page on `DOMContentLoaded`, restores note text from cookies, and intercepts form submission to save the updated content (plus course name and timestamp) for one year.
* Every save records the timestamp so learners and exports can show when each section was last updated.
* A single “Export Notes” button is injected and fixed to the bottom-left corner. Clicking it gathers every stored note for the detected course ID(s)—even those captured on other pages—and downloads a Markdown file such as `bc-gov-essentials-notes.md`.

## Adding note forms

### Basic accessible form structure

```html
<form class="noodle" data-courseid="86" data-sectionid="section1" data-sectiontitle="Introduction">
    <label for="notes-section1" class="sr-only">
        Notes for Section 1: Introduction
        <span class="sr-only">(saved locally in your browser)</span>
    </label>
    <textarea id="notes-section1"
              class="form-control"
              placeholder="Capture your notes…"
              maxlength="5000"
              rows="4"
              autocomplete="off"
              aria-describedby="notes-section1-hint"></textarea>
    <small id="notes-section1-hint" class="form-text text-muted">
        Your notes are saved automatically in your browser
    </small>
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

* Use unique `data-sectionid` values so each note persists independently.
* Reuse the same `data-courseid` across a course. If you repeat a `sectionid` on another page with the same course ID, the stored note carries over.
* Optional: Add `data-sectiontitle` to provide a human-readable section name for exports.
* Include `noodle.js` at the bottom of any page that uses these forms (after the DOM content).

## Files

| File | Description |
| --- | --- |
| `test.html` | Sample course landing page with two noodle note forms. |
| `noodle.js` | Vanilla JS helper that manages cookies, status messages, cross-page exports, and the floating button. |
| `README.md` | This guide. |
