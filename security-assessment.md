# Security Assessment: Noodle.js

**Assessment Date:** 2025-12-17
**Assessed Version:** Current main branch
**Assessor:** Security Review

---

## Executive Summary

Noodle.js is a client-side note-taking widget designed to be embedded on third-party web pages. This assessment evaluates whether embedding noodle.js introduces security risks to host sites.

**Overall Rating: SAFE FOR EMBEDDING**

The widget does not introduce XSS vectors, does not exfiltrate data, and operates entirely client-side. Host sites can safely include noodle.js with standard precautions.

---

## Scope

This assessment covers:
- `noodle.js` - The core widget
- `docs/generator.html` - The form builder tool
- Security implications for sites embedding the widget

---

## Findings Summary

| Category | Risk Level | Status |
|----------|-----------|--------|
| Cross-Site Scripting (XSS) | None | Mitigated |
| Data Exfiltration | None | No network requests |
| Cookie Security | Low | Properly scoped |
| DOM Manipulation | Low | Predictable, safe |
| Prototype Pollution | None | Mitigated |
| Privacy | Medium | By design (documented) |

---

## Detailed Findings

### 1. Cross-Site Scripting (XSS)

**Risk: NONE**

All user-controlled content is properly sanitized:

- **Output escaping:** `escapeHtml()` applied to all user content in exports (Markdown, HTML, DOCX)
- **DOM updates:** Uses `textContent` instead of `innerHTML` for dynamic content
- **URL sanitization:** `sanitizeUrl()` blocks `javascript:` protocol
- **ID validation:** `validateId()` enforces alphanumeric whitelist

The only `innerHTML` usage involves static strings or clearing content:
```javascript
modal.list.innerHTML = "";  // Safe - clearing
sortToggle.innerHTML = "Sort: Course Order ↓";  // Safe - static
```

### 2. Data Exfiltration

**Risk: NONE**

Verified the script makes zero external requests:
- No `fetch()` or `XMLHttpRequest`
- No `sendBeacon()` or WebSocket
- No dynamic image/script loading
- No form submissions to external endpoints

All data remains in the user's browser cookies. A compromised version could theoretically exfiltrate data, so use SRI when loading from CDN.

### 3. Cookie Security

**Risk: LOW**

Cookies are set with security flags:
```javascript
cookie += "; SameSite=Strict";  // CSRF protection
cookie += "; Secure";  // HTTPS only (when applicable)
cookie += "; path=/";  // Scoped to domain
```

**Considerations:**
- Cookies prefixed with `noodle_` to avoid collisions
- Script reads `document.cookie` but only processes its own cookies
- HttpOnly not possible (JavaScript needs read access by design)

### 4. DOM Manipulation

**Risk: LOW**

The widget injects:
- Fixed-position button: `#noodle-notes-button`
- Modal overlay: `#noodle-notes-overlay`
- Status/counter elements within forms

**Mitigations:**
- Unique, namespaced IDs prevent collisions
- Modal uses `inert` attribute to manage focus
- No interference with host page functionality

### 5. Prototype Pollution

**Risk: NONE**

The `parseSavedValue()` function implements defense-in-depth:
- Blocks `__proto__`, `constructor`, `prototype` properties
- Creates clean objects with `Object.create(null)`
- Validates types for all fields
- Whitelists expected properties

### 6. Input Validation

**Risk: NONE**

All inputs are validated:

| Input | Validation | Limit |
|-------|-----------|-------|
| Course ID | Alphanumeric + hyphen/underscore | 100 chars |
| Section ID | Alphanumeric + hyphen/underscore | 100 chars |
| Note text | String type check | 5,000 chars |
| Course name | String type check | 200 chars |
| Timestamps | ISO 8601 regex | N/A |
| URLs | Protocol whitelist (http/https) | N/A |

### 7. Form Generator Security

**Risk: NONE** (Fixed)

The generator tool (`docs/generator.html`) now properly escapes all user input in generated HTML output:
- Section titles escaped with `escapeHtml()`
- Course names escaped with `escapeHtml()`
- Page order escaped with `escapeHtml()`
- IDs sanitized via `slugifyId()` whitelist

---

## Privacy Considerations

**Risk: MEDIUM** (By Design)

Notes are stored in cleartext cookies:
- Visible to JavaScript on the same origin
- Included in HTTP headers (mitigated by Secure flag on HTTPS)
- No encryption (would require key management complexity)

**Recommendation:** Document that users should not store sensitive personal information in notes.

---

## Trust Model

When embedding noodle.js, site owners should understand:

1. **Full DOM access** - Like any JavaScript, it can read/modify the page
2. **Cookie access** - Can read all cookies (but only processes `noodle_*`)
3. **No external communication** - Data stays client-side
4. **No authentication** - Notes are per-browser, not per-user

### Recommended Embedding Practice

```html
<!-- Use SRI hash when loading from CDN -->
<script src="https://cdn.example.com/noodle.js"
        integrity="sha384-[hash]"
        crossorigin="anonymous"></script>
```

---

## Comparison with Previous Audit

| Issue | Previous Status | Current Status |
|-------|----------------|----------------|
| XSS in exports | Fixed (Dec 2025) | Verified secure |
| Cookie security flags | Fixed (Dec 2025) | Verified secure |
| Prototype pollution | Fixed (Dec 2025) | Verified secure |
| ID injection | Fixed (Dec 2025) | Verified secure |
| Generator HTML injection | Vulnerable | **Fixed (Dec 2025)** |

---

## Security Controls Summary

### Implemented

- HTML entity escaping for all output
- Strict input validation with whitelists
- Cookie security flags (SameSite, Secure)
- Prototype pollution defense
- URL protocol validation
- Length limits on all inputs
- Type checking for parsed data

### Not Applicable

- CSRF tokens (client-side only, no server)
- Authentication (by design)
- Rate limiting (client-side only)
- Audit logging (client-side only)

### Recommendations for Host Sites

1. **Use HTTPS** - Ensures Secure cookie flag is applied
2. **Consider CSP** - Add noodle.js to script-src if using Content Security Policy
3. **Use SRI** - Verify script integrity when loading from CDN
4. **User education** - Inform users notes are stored locally, not synced

---

## Attack Surface Analysis

### What an attacker CANNOT do via noodle.js:

- Steal session cookies (no exfiltration mechanism)
- Execute arbitrary JavaScript (all inputs sanitized)
- Perform CSRF attacks (SameSite=Strict)
- Pollute Object prototype (blocked)
- Inject HTML into host page (uses textContent)

### What an attacker COULD do with a compromised noodle.js:

- Read/modify page DOM (inherent to any JS)
- Access cookies (inherent to any JS)
- Exfiltrate data (if script is replaced)

**Mitigation:** Use Subresource Integrity (SRI) to detect tampering.

---

## Compliance Notes

### OWASP Top 10 (2021)

| Category | Status |
|----------|--------|
| A01: Broken Access Control | N/A (client-side) |
| A02: Cryptographic Failures | Noted (no encryption) |
| A03: Injection | Mitigated |
| A04: Insecure Design | Acceptable |
| A05: Security Misconfiguration | Mitigated |
| A06: Vulnerable Components | Bootstrap 5.3 with SRI |
| A07: Auth Failures | N/A (no auth) |
| A08: Data Integrity | Mitigated |
| A09: Logging Failures | N/A (client-side) |
| A10: SSRF | N/A (no server requests) |

### CWE Coverage

- CWE-79 (XSS): Mitigated
- CWE-20 (Input Validation): Mitigated
- CWE-352 (CSRF): Mitigated
- CWE-1321 (Prototype Pollution): Mitigated

---

## Conclusion

Noodle.js is safe to embed on third-party web pages. The widget:

- Does not introduce XSS vulnerabilities to host sites
- Does not exfiltrate any data
- Properly validates and sanitizes all inputs
- Uses secure cookie attributes
- Operates entirely client-side

The primary consideration is privacy: notes are stored unencrypted in cookies. This is a design choice appropriate for the use case (course notes in educational environments) but should be documented for end users.

---

## Revision History

| Date | Change |
|------|--------|
| 2025-12-17 | Initial assessment, generator XSS fixed |
| 2025-12-06 | Previous audit (see audits/SECURITY-AUDIT-STATUS.md) |
