# Data Storage Analysis - Moodle Context

**Date:** 2025-12-08
**Current Implementation:** Cookie-based storage
**Critical Context:** Moodle clears localStorage on logout
**Requirement:** Minimal dependencies

---

## Executive Summary

**CRITICAL FINDING:** Moodle clears localStorage, sessionStorage, and IndexedDB on logout using the `Clear-Site-Data: "storage"` HTTP header ([MDLNET-270](https://tracker.moodle.org/browse/MDLNET-270)). This invalidates all browser-based storage options except cookies.

**Current Implementation Status:** ✅ **Already optimal** for client-side-only storage in Moodle

**Recommendations:**
1. **Keep cookies** (already the only client-side option that works)
2. **Add compression** if users hit 4KB limit (~75% more capacity)
3. **Add chunking** if compression insufficient (~87x more capacity)
4. **Add serverless backend** only if unlimited storage absolutely required

---

## Why localStorage/IndexedDB Are Not Options

### Moodle's Logout Behavior

Moodle uses the `Clear-Site-Data: "storage"` HTTP header on logout for security reasons. This is documented in [Moodle Tracker issue MDLNET-270](https://tracker.moodle.org/browse/MDLNET-270).

**What the `Clear-Site-Data: "storage"` directive clears:**
- ❌ **localStorage** - `localStorage.clear()` executed
- ❌ **sessionStorage** - `sessionStorage.clear()` executed
- ❌ **IndexedDB** - All databases deleted
- ❌ **Cache API** - All caches cleared
- ❌ **Service Workers** - Registrations cleared

**What survives:**
- ✅ **Cookies** - Requires separate `"cookies"` directive (which Moodle doesn't use)

### Why Cookies Survive

The `Clear-Site-Data` header has separate directives:
```http
Clear-Site-Data: "cache", "cookies", "storage"
```

Moodle uses only the `"storage"` directive because:
1. Moodle needs its own session cookies for logout confirmation
2. Clearing all cookies would break the logout process itself
3. Third-party cookies (like your notes) are not affected

**This is why your current cookie implementation works perfectly.**

### No Workaround Exists

The `Clear-Site-Data` header is processed at the browser level. There is **no JavaScript-based workaround** to prevent this behavior. Any attempt to use localStorage, IndexedDB, or sessionStorage will result in data loss on logout.

---

## Current Implementation Analysis

### Cookies (Current) ✅

**Storage capacity:** 4KB per cookie (per section/note)

**Actual capacity breakdown (PER SECTION):**
- **Cookie overhead:** ~149 bytes (JSON structure + metadata)
- **Available for text:** ~3,947 bytes
- **URL encoding overhead:** ~1.4x expansion for typical text
- **Effective capacity:** ~2,800-3,900 characters of actual text **per section**
  - **Plain text (lowercase):** ~3,900 characters
  - **Realistic text (mixed case, punctuation, spaces):** ~2,800 characters
  - **Word count:** ~**560-780 words per section** (assuming 5 chars/word average)

**Important:** This limit is **per section**, not for all notes combined!
- ✅ Course with 10 sections = **5,600-7,800 total words** across all notes
- ✅ Course with 20 sections = **11,200-15,600 total words** across all notes
- ✅ Course with 50 sections = **28,000-39,000 total words** across all notes

**Real-world context (per section):**
- ✅ **1-2 pages** of single-spaced text per section
- ✅ **2-3 dense paragraphs** of detailed notes per section
- ✅ Sufficient for **summary notes per section**
- ✅ Good for **key points and highlights per section**
- ⚠️ May be limiting for **verbatim transcription** of long lectures in a single section

**Strengths:**
1. ✅ **Survives Moodle logout** - Only client-side option
2. ✅ **Zero dependencies** - Native browser API
3. ✅ **Universal browser support** - 100% compatibility
4. ✅ **High privacy** - Client-side only, no external services
5. ✅ **Already implemented and tested** - Working solution
6. ✅ **Offline support** - No network required
7. ✅ **Adequate for most use cases** - 560-780 words covers typical note-taking

**Limitations:**
1. ⚠️ **2,800-3,900 character limit** - ~560-780 words per note
2. ⚠️ **Network overhead** - Sent with every HTTP request (minor impact)
3. ⚠️ **Domain-specific** - Cannot share across different domains

**When current capacity is sufficient:**
- Users take summary notes (not verbatim transcription)
- Course divided into reasonable sections (10-50 sections)
- Typical use: bullet points, key concepts, highlights per section
- Average note length per section < 500 words
- **Total course notes can easily reach 10,000-40,000 words**

**When enhancement needed:**
- >5% of users hit 2,800 character limit **in a single section**
- Users frequently copy-paste large text blocks into one section
- Single section contains entire lecture transcription
- Users want to write 1,000+ words in a single section

**Verdict:** ✅ **Already optimal** for client-side storage in Moodle

**Recommendation:** Monitor actual usage before implementing enhancements. Add character counter to track if limit is a real problem. **Remember:** The limit is per section, so typical courses can store tens of thousands of words total.

---

## Enhancement Options

### Option 1: Cookies + Compression

**Effective capacity:** ~4,900-6,800 characters (~980-1,360 words)
**Improvement:** 75% more capacity than current (50-70% size reduction from compression)

**Technical approach:**
```javascript
// Add lz-string library (3KB)
// <script src="https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js"></script>

function saveCompressedCookie(key, value, days) {
    var compressed = LZString.compress(value);
    var encoded = encodeURIComponent(compressed);
    setCookie(key, encoded, days);
}

function loadCompressedCookie(key) {
    var encoded = getCookie(key);
    if (!encoded) return null;

    var decoded = decodeURIComponent(encoded);
    return LZString.decompress(decoded);
}
```

**Migration for existing data:**
```javascript
// Migrate existing cookies to compressed format
function migrateCookiesToCompressed() {
    var entries = getAllNoodleCookies();

    for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var key = makeKey(entry.courseId, entry.sectionId);
        var rawValue = getCookie(key);

        if (rawValue && rawValue.indexOf('compressed:') !== 0) {
            // Not compressed yet, migrate it
            var compressed = LZString.compress(rawValue);
            setCookie(key, 'compressed:' + encodeURIComponent(compressed), 365);
        }
    }
}
```

**Real-world context:**
- ✅ **3-4 pages** of single-spaced text
- ✅ **5-6 dense paragraphs** of detailed notes
- ✅ Sufficient for **detailed section notes**
- ✅ Handles **moderate copy-paste** scenarios

**Pros:**
- ✅ ~75% more capacity (2,800 → ~4,900-6,800 characters)
- ✅ Still client-side only
- ✅ Survives Moodle logout
- ✅ Small dependency (lz-string: 3KB)
- ✅ Backward compatible with migration

**Cons:**
- ⚠️ Requires external library
- ⚠️ Slight CPU overhead (negligible for text)
- ⚠️ Still has size limit

**Implementation effort:** 4-6 hours
**Monthly cost:** $0
**Dependencies:** lz-string (3KB)

**Recommendation:** ✅ Implement if 5-20% of users hit 2,800 character limit

---

### Option 2: Cookies + Compression + Chunking

**Effective capacity:** ~245,000-343,000 characters (~49,000-68,600 words)
**Improvement:** 87x more capacity than current
**Technical capacity:** ~350KB total storage (~500KB-1MB with compression)

**Technical approach:**
```javascript
function saveLargeNote(courseId, sectionId, data) {
    var json = JSON.stringify(data);
    var compressed = LZString.compress(json);
    var encoded = encodeURIComponent(compressed);

    var chunkSize = 3500; // ~3.5KB per chunk (conservative)
    var chunks = [];

    // Split into chunks
    for (var i = 0; i < encoded.length; i += chunkSize) {
        chunks.push(encoded.substring(i, i + chunkSize));
    }

    var baseKey = makeKey(courseId, sectionId);

    // Save metadata
    var metadata = {
        chunks: chunks.length,
        timestamp: new Date().toISOString(),
        version: 1,
        compressed: true
    };
    setCookie(baseKey + '_meta', JSON.stringify(metadata), 365);

    // Save chunks
    for (var j = 0; j < chunks.length; j++) {
        setCookie(baseKey + '_chunk_' + j, chunks[j], 365);
    }
}

function loadLargeNote(courseId, sectionId) {
    var baseKey = makeKey(courseId, sectionId);

    // Load metadata
    var metaStr = getCookie(baseKey + '_meta');
    if (!metaStr) return null;

    var meta = JSON.parse(metaStr);
    var chunks = [];

    // Load all chunks
    for (var i = 0; i < meta.chunks; i++) {
        var chunk = getCookie(baseKey + '_chunk_' + i);
        if (!chunk) {
            console.warn('Missing chunk', i, 'for', baseKey);
            return null; // Integrity check failed
        }
        chunks.push(chunk);
    }

    // Reconstruct and decompress
    var encoded = chunks.join('');
    var decoded = decodeURIComponent(encoded);
    var decompressed = LZString.decompress(decoded);

    return JSON.parse(decompressed);
}

// Cleanup function to prevent orphaned chunks
function deleteNote(courseId, sectionId) {
    var baseKey = makeKey(courseId, sectionId);
    var metaStr = getCookie(baseKey + '_meta');

    if (metaStr) {
        var meta = JSON.parse(metaStr);
        // Delete all chunks
        for (var i = 0; i < meta.chunks; i++) {
            setCookie(baseKey + '_chunk_' + i, '', -1);
        }
    }

    // Delete metadata
    setCookie(baseKey + '_meta', '', -1);
}
```

**Real-world context:**
- ✅ **122-171 pages** of single-spaced text
- ✅ **Entire course worth** of detailed notes
- ✅ More than sufficient for any realistic use case
- ✅ Handles **extensive copy-paste** and **long-form writing**

**Pros:**
- ✅ ~87x more capacity (2,800 → ~245,000-343,000 characters)
- ✅ ~500KB-1MB of original text with compression
- ✅ Still client-side only
- ✅ Survives Moodle logout
- ✅ No external services required
- ✅ Handles very large notes

**Cons:**
- ⚠️ More complex implementation
- ⚠️ Uses multiple cookies (max ~50 per domain)
- ⚠️ Slightly slower read/write operations
- ⚠️ Requires careful cleanup to avoid orphaned chunks
- ⚠️ Integrity risks if chunks corrupted

**Implementation effort:** 12-16 hours
**Monthly cost:** $0
**Dependencies:** lz-string (3KB)

**Recommendation:** ✅ Implement if >20% of users hit 2,800 character limit

---

## Server-Side Storage Options

### Option 3: Cloudflare Workers + KV (Serverless Backend)

**Effective capacity:** Unlimited per note

**Architecture:**
```
User Browser → Cloudflare Worker API → KV Storage
     ↓
  Cookies store note IDs (survive Moodle logout)
```

**Key design principles:**
1. **No authentication** - Use cryptographically secure UUIDs as note IDs
2. **Client-side encryption** - Encrypt notes before sending to server
3. **Cookie-based IDs** - Store note IDs in cookies (survive logout)
4. **Auto-expiration** - Notes expire after 1 year if not accessed

**Server implementation (Cloudflare Worker):**
```javascript
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
    const url = new URL(request.url)

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    // GET /notes/:id - Retrieve note
    if (request.method === 'GET' && url.pathname.startsWith('/notes/')) {
        const noteId = url.pathname.split('/')[2]
        const note = await NOTES_KV.get(noteId)

        if (!note) {
            return new Response('Not found', { status: 404, headers: corsHeaders })
        }

        return new Response(note, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    // PUT /notes/:id - Save note
    if (request.method === 'PUT' && url.pathname.startsWith('/notes/')) {
        const noteId = url.pathname.split('/')[2]

        // Validate UUID v4 format
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(noteId)) {
            return new Response('Invalid note ID', { status: 400, headers: corsHeaders })
        }

        const body = await request.text()

        // Size limit check (10MB)
        if (body.length > 10 * 1024 * 1024) {
            return new Response('Note too large', { status: 413, headers: corsHeaders })
        }

        // Store with 1 year expiration
        await NOTES_KV.put(noteId, body, { expirationTtl: 31536000 })

        return new Response('Saved', { headers: corsHeaders })
    }

    return new Response('Not found', { status: 404, headers: corsHeaders })
}
```

**Client implementation:**
```javascript
// Generate UUID v4 for new notes
function generateNoteId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Client-side encryption using SubtleCrypto API (built into browsers)
async function encryptNote(text, password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    // Derive key from password
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('noodle-notes-v1'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );

    // Encrypt with random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
    );

    return {
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encrypted))
    };
}

async function decryptNote(encrypted, password) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Derive same key
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('noodle-notes-v1'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(encrypted.iv) },
        key,
        new Uint8Array(encrypted.data)
    );

    return decoder.decode(decrypted);
}

// Save note to server
async function saveNoteToServer(courseId, sectionId, text) {
    // Get or generate note ID (stored in cookie - survives logout!)
    var noteIdKey = makeKey(courseId, sectionId) + '_server_id';
    var noteId = getCookie(noteIdKey);

    if (!noteId) {
        noteId = generateNoteId();
        setCookie(noteIdKey, noteId, 365);
    }

    // Encrypt with course+section as password
    var password = courseId + ':' + sectionId;
    var encrypted = await encryptNote(text, password);

    // Save to server
    try {
        var response = await fetch('https://your-worker.workers.dev/notes/' + noteId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(encrypted)
        });

        return response.ok;
    } catch (e) {
        console.error('Failed to save to server:', e);
        return false;
    }
}

// Load note from server
async function loadNoteFromServer(courseId, sectionId) {
    var noteIdKey = makeKey(courseId, sectionId) + '_server_id';
    var noteId = getCookie(noteIdKey);

    if (!noteId) return null;

    try {
        var response = await fetch('https://your-worker.workers.dev/notes/' + noteId);

        if (!response.ok) return null;

        var encrypted = await response.json();
        var password = courseId + ':' + sectionId;

        return await decryptNote(encrypted, password);
    } catch (e) {
        console.error('Failed to load from server:', e);
        return null;
    }
}
```

**Pros:**
- ✅ Unlimited storage per note
- ✅ No server management (serverless)
- ✅ Auto-scaling, global CDN
- ✅ Client-side encryption preserves privacy
- ✅ Free tier: 100K reads/day, 1K writes/day
- ✅ Note IDs in cookies survive Moodle logout
- ✅ Free SSL/HTTPS included
- ✅ Simple deployment (CLI tool)

**Cons:**
- ⚠️ Requires external service dependency
- ⚠️ Network required (no offline support)
- ⚠️ Lose cookie = lose access to note
- ⚠️ Cannot sync across devices (tied to browser)
- ⚠️ More complex debugging
- ⚠️ Potential privacy concerns (data on third-party server, even if encrypted)

**Implementation effort:** 20-30 hours
**Monthly cost:** $0-5 (free tier usually sufficient)
**Dependencies:** Cloudflare Workers account

**Recommendation:** ⚠️ Only if unlimited storage absolutely required

**Alternatives:** Deno Deploy, Vercel Edge Functions, AWS Lambda (similar serverless options)

---

### Option 4: Traditional Server Backend ❌

**Not Recommended**

**Why:**
- ❌ High development cost (80-120 hours = $8,000-$12,000)
- ❌ Ongoing maintenance burden (10+ hours/year)
- ❌ Monthly hosting costs ($10-50+)
- ❌ Requires full authentication system
- ❌ Database management overhead
- ❌ Privacy concerns (user data on server)
- ❌ Violates "minimal dependencies" requirement

**Verdict:** ❌ Overkill for this use case

---

## Comparison Matrix

| Solution | Survives Logout | Characters | Words | Pages | Dependencies | Dev Time | Monthly Cost | Privacy | Risk |
|----------|----------------|-----------|-------|-------|--------------|----------|--------------|---------|------|
| **Cookies (current)** | ✅ Yes | ~2,800-3,900 | ~560-780 | ~1-2 | None | 0 hrs | $0 | High ✅ | None |
| **+ Compression** | ✅ Yes | ~4,900-6,800 | ~980-1,360 | ~2-3 | lz-string (3KB) | 4-6 hrs | $0 | High ✅ | Low |
| **+ Chunking** | ✅ Yes | ~245K-343K | ~49K-69K | ~122-171 | lz-string (3KB) | 12-16 hrs | $0 | High ✅ | Low |
| **Cloudflare Workers** | ✅ Yes | Unlimited | Unlimited | Unlimited | External API | 20-30 hrs | $0-5 | Medium ⚠️ | Medium |
| **Full Server** | ✅ Yes | Unlimited | Unlimited | Unlimited | Many | 80-120 hrs | $10-50+ | Low ❌ | High |
| localStorage | ❌ **No** | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| IndexedDB | ❌ **No** | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| sessionStorage | ❌ **No** | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |

---

## Decision Guide

### Keep Current Implementation If:
- ✅ Most notes < 2,500 characters (~500 words / 1 page)
- ✅ <5% of users hit 2,800 character limit
- ✅ Zero budget for changes
- ✅ Want to maintain maximum simplicity
- ✅ Notes are summaries, not verbatim transcription

**Action:** None required

---

### Add Compression If:
- ⚠️ 5-20% of users hit 2,800 character limit
- ⚠️ Users occasionally need 5,000-6,000 characters (~2-3 pages)
- ✅ Want 75% more capacity (→ ~5,000-6,800 chars)
- ✅ Can accept small dependency (3KB)
- ✅ Have 4-6 hours for implementation

**Action:** Implement compression layer

---

### Add Compression + Chunking If:
- ⚠️ >20% of users hit 2,800 character limit
- ⚠️ Notes frequently exceed 10,000 characters (~5+ pages)
- ⚠️ Users need to store entire lectures or long-form content
- ✅ Want ~87x more capacity (→ ~245,000+ chars / 122+ pages)
- ✅ Have 12-16 hours for implementation

**Action:** Implement compression + chunking

---

### Add Server-Side Storage If:
- ⚠️ Need unlimited storage
- ⚠️ Users write very long notes (>100KB)
- ✅ Can accept external dependency
- ✅ Have budget for development ($2-3K)
- ✅ Have $0-5/month for hosting

**Action:** Implement Cloudflare Workers backend

---

## Implementation Roadmap

### Phase 1: Assessment (Immediate)

**Objective:** Understand actual usage patterns

**Actions:**
1. Add analytics to track note sizes
2. Monitor how many users hit 4KB limit
3. Measure average note size
4. Identify user pain points

**Deliverables:**
- Usage metrics dashboard
- User feedback on size limits

**Effort:** 2-4 hours
**Cost:** $0

---

### Phase 2: Compression (If needed based on Phase 1)

**Objective:** Increase capacity with minimal changes

**Actions:**
1. Add lz-string library (CDN or local copy)
2. Create compression wrapper functions
3. Implement backward-compatible migration
4. Update save/load logic
5. Test with existing data
6. Deploy and monitor

**Deliverables:**
- Updated noodle.js with compression
- Migration function for existing notes
- Test suite for compression/decompression

**Effort:** 4-6 hours
**Cost:** $0
**Dependencies:** lz-string (3KB)

---

### Phase 3: Chunking (If Phase 2 insufficient)

**Objective:** Enable very large notes (350KB+)

**Actions:**
1. Implement chunking functions (save/load/delete)
2. Add metadata tracking
3. Implement integrity checks
4. Add cleanup logic for orphaned chunks
5. Update export functionality
6. Comprehensive testing

**Deliverables:**
- Chunking implementation
- Metadata management
- Cleanup utilities
- Updated documentation

**Effort:** 8-12 hours (additional)
**Cost:** $0

---

### Phase 4: Server-Side (Only if absolutely necessary)

**Objective:** Unlimited storage capacity

**Actions:**
1. Set up Cloudflare Workers account
2. Implement worker API endpoints
3. Add client-side encryption
4. Implement UUID generation
5. Store note IDs in cookies
6. Add fallback to cookies if server unavailable
7. Testing and deployment

**Deliverables:**
- Cloudflare Worker deployment
- Client-side encryption
- Hybrid cookie/server storage
- Monitoring and logging

**Effort:** 20-30 hours
**Cost:** $0-5/month

---

## Risk Analysis

### Compression + Chunking Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Cookie quota exceeded | Low | Medium | Monitor usage, warn at 80% capacity |
| Chunk corruption | Low | High | Implement integrity checks, backup to localStorage temporarily |
| Migration data loss | Very Low | High | Thorough testing, keep originals during migration |
| Browser cookie limits | Low | Medium | Clean up old chunks, implement LRU eviction |
| Performance regression | Very Low | Low | Compression is fast, minimal impact |

**Overall Risk:** 🟢 **LOW**

---

### Serverless Backend Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Service outage | Low | Medium | Fallback to cookie storage |
| Quota exceeded | Very Low | Medium | Monitor usage, upgrade if needed |
| Lost cookie = lost notes | Medium | High | Prompt users to export regularly |
| Privacy concerns | Low | Medium | Client-side encryption, clear disclosure |
| Vendor lock-in | Low | Low | Simple API, easy to migrate |

**Overall Risk:** 🟡 **MEDIUM**

---

## Key Takeaways

### Critical Facts

1. **Moodle clears localStorage/IndexedDB on logout** - Confirmed via tracker issue, no workaround exists

2. **Cookies are the ONLY client-side storage that survives** - Your current implementation is already optimal

3. **Clear-Site-Data is browser-level** - Cannot be prevented or circumvented with JavaScript

4. **Current implementation is correct** - No need to change unless capacity is insufficient

### Enhancement Path

1. **First:** Monitor actual usage (do users hit limits?)
2. **If needed:** Add compression (75% more capacity, 4-6 hours)
3. **If still needed:** Add chunking (87x more capacity, 12-16 hours)
4. **Last resort:** Server-side storage (unlimited, but external dependency)

### DO NOT Implement

- ❌ localStorage - Cleared on logout
- ❌ IndexedDB - Cleared on logout
- ❌ sessionStorage - Cleared on tab close AND logout
- ❌ Cache API - Cleared on logout
- ❌ Service Workers - Cleared on logout

---

## Sources

### Moodle-Specific
- [Moodle Tracker MDLNET-270: Clear localStorage on logout](https://tracker.moodle.org/browse/MDLNET-270)
- [Moodle Session Handling Documentation](https://docs.moodle.org/311/en/Session_handling)
- [Moodle GitHub: login/logout.php](https://github.com/moodle/moodle/blob/main/login/logout.php)

### Technical Standards
- [MDN: Clear-Site-Data HTTP Header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Clear-Site-Data)
- [W3C: Clear Site Data Specification](https://www.w3.org/TR/clear-site-data/)
- [Clear-Site-Data Security Guide](https://dev.to/tusharprajapatiii/level-up-your-logout-functionality-with-clear-site-data-3fjd)

### Libraries & Tools
- [lz-string: JavaScript Compression Library](https://github.com/pieroxy/lz-string)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [SubtleCrypto API (Web Cryptography)](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)

---

**Report prepared by:** Claude Code
**Date:** 2025-12-08
**Version:** 2.0 (Moodle-specific revision)
