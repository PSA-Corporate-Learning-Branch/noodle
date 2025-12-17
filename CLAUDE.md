# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Noodle is a lightweight note-taking widget that embeds into web pages and stores notes in cookies (not localStorage). Designed for environments like Moodle that clear localStorage on logout. Users can export notes as Markdown or HTML.

## Architecture

- **noodle.js** - Single vanilla JS file (IIFE pattern) that handles:
  - Cookie-based persistence with security flags (SameSite=Strict, Secure on HTTPS)
  - Auto-save (2s debounce) and manual save
  - Floating "Noodle Notes" button with modal for viewing/exporting all notes
  - Cross-page note collection using `data-courseid` to group notes
  - XSS protection via `escapeHtml()`, input validation, and prototype pollution defense

- **docs/** - GitHub Pages site with demo pages and form generator
- **Root noodle.js** is minified via Terser during deploy (see `.github/workflows/pages.yml`)

## Key Data Structures

Notes are stored in cookies with key format: `noodle_<sectionid>_<courseid>`

Cookie value is URL-encoded JSON:
```json
{
  "text": "note content",
  "courseName": "Course Name",
  "savedAt": "ISO timestamp",
  "pageUrl": "source URL",
  "sectionTitle": "Section Title",
  "sectionOrder": 0,
  "pageOrder": 1
}
```

## Development

No build step required for development. Open HTML files directly in browser.

**Deployment:** Push to `main` triggers GitHub Actions that:
1. Copies `docs/` to `_site/`
2. Minifies `noodle.js` with Terser
3. Deploys to GitHub Pages

## Form Requirements

Each note form needs:
- `class="noodle"`
- `data-courseid` (required) - groups notes across pages
- `data-sectionid` (required) - unique per section, alphanumeric/hyphens/underscores only
- `data-sectiontitle` (optional) - human-readable name
- `data-page-order` (optional) - numeric ordering for multi-page courses
- Hidden input: `<input type="hidden" name="course-name" value="...">`

## Security Considerations

Security audit completed (see SECURITY-AUDIT-STATUS.md). Key protections:
- ID validation: alphanumeric, hyphens, underscores only (100 char limit)
- Note text: 5000 char limit, HTML-escaped on output
- JSON parsing: prototype pollution defense, type validation
- Cookies: SameSite=Strict, Secure flag on HTTPS

## Code Style

- Vanilla JS only (no frameworks/bundlers)
- ES5 compatible for broad browser support
- Bootstrap 5.3+ for styling with dark mode support
- Semantic HTML with ARIA attributes for accessibility
