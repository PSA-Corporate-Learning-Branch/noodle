# Noodle Course Notes Demo

A static example page (`test.html`) demonstrates how to embed lightweight learner note fields inside course content (e.g., Moodle). Every note form is stored entirely in the browser via cookies so learners keep their notes even if Moodle clears `localStorage` on logout. A floating **Export Notes** button lets them download all notes for the current course as a Markdown file.

## How it works

* Each note block is a standard `<form class="noodle">` that must declare `data-courseid` and `data-sectionid`. These values determine the cookie key (`noodle_<sectionid>_<courseid>`) so notes stay unique per course section.
* Include a hidden `<input type="hidden" name="course-name" value="...">` inside every form. The value is stored with the notes and used for exports.
* `noodle.js` scans the page on `DOMContentLoaded`, restores note text from cookies, and intercepts form submission to save the updated content (plus course name and timestamp) for one year.
* Every save records the timestamp so learners and exports can show when each section was last updated.
* A single “Export Notes” button is injected and fixed to the bottom-left corner. Clicking it gathers every stored note for the detected course ID(s)—even those captured on other pages—and downloads a Markdown file such as `bc-gov-essentials-notes.md`.

## Adding note forms

```html
<form class="noodle" data-courseid="86" data-sectionid="section1">
    <textarea placeholder="Capture your notes…"></textarea>
    <input type="hidden" name="course-name" value="B.C. Provincial Government Essentials">
    <button type="submit">Save</button>
</form>
```

* Use unique `data-sectionid` values so each note persists independently.
* Reuse the same `data-courseid` across a course. If you repeat a `sectionid` on another page with the same course ID, the stored note carries over.
* Include `noodle.js` at the bottom of any page that uses these forms (after the DOM content).

## Files

| File | Description |
| --- | --- |
| `test.html` | Sample course landing page with two noodle note forms. |
| `noodle.js` | Vanilla JS helper that manages cookies, status messages, cross-page exports, and the floating button. |
| `README.md` | This guide. |
