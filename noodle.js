/*
 * Noodle course notes helper.
 * Origin: Noodle notes demo for course pages.
 * Ownership: PSA Corporate Learning Branch.
 * License: GPL.
 * Repo: https://github.com/PSA-Corporate-Learning-Branch/noodle
 */
(function () {
    function escapeHtml(unsafe) {
        if (!unsafe) return "";
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function validateAttributeValue(value, maxLength) {
        if (!value) return "";
        var str = String(value);
        if (maxLength && str.length > maxLength) {
            str = str.substring(0, maxLength);
        }
        return str;
    }

    function validateNoteText(text, maxLength) {
        maxLength = maxLength || 5000; // Default 5000 characters
        if (!text) return "";
        var str = String(text);
        if (str.length > maxLength) {
            return str.substring(0, maxLength);
        }
        return str;
    }

    function validateId(id, maxLength) {
        // Only allow alphanumeric, hyphens, and underscores
        // This prevents injection via IDs
        if (!id) return "";
        var str = String(id);

        // Check against whitelist pattern
        var validPattern = /^[a-zA-Z0-9_-]+$/;
        if (!validPattern.test(str)) {
            console.warn("Invalid ID format detected:", str);
            // Strip invalid characters
            str = str.replace(/[^a-zA-Z0-9_-]/g, "");
        }

        // Enforce length limit
        maxLength = maxLength || 100;
        if (str.length > maxLength) {
            str = str.substring(0, maxLength);
        }

        return str;
    }

    function setCookie(name, value, days) {
        var expires = "";
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }

        // Build cookie with security flags
        var cookie = name + "=" + value + expires;

        // Restrict path to avoid broad cookie scope
        cookie += "; path=/";

        // SameSite=Strict prevents CSRF attacks
        cookie += "; SameSite=Strict";

        // Secure flag ensures HTTPS-only transmission (when available)
        // Only add Secure flag if page is served over HTTPS
        if (window.location.protocol === "https:") {
            cookie += "; Secure";
        }

        // Note: HttpOnly flag cannot be set via JavaScript (requires server-side)
        // This is intentional as we need JavaScript access to read the notes

        document.cookie = cookie;
    }

    function getCookie(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) === ' ') {
                c = c.substring(1, c.length);
            }
            if (c.indexOf(nameEQ) === 0) {
                return c.substring(nameEQ.length, c.length);
            }
        }
        return null;
    }

    var courseRegistry = {};

    function makeKey(courseId, sectionId) {
        var sectionKey = encodeURIComponent(sectionId);
        var courseKey = courseId ? "_" + encodeURIComponent(courseId) : "";
        return "noodle_" + sectionKey + courseKey;
    }

    function ensureCourseEntry(courseId) {
        if (!courseRegistry[courseId]) {
            courseRegistry[courseId] = {
                forms: [],
                courseName: ""
            };
        }
        return courseRegistry[courseId];
    }

    function sanitizeFileName(name) {
        return (name || "course-notes")
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9\-_]+/g, "");
    }

    function sanitizeUrl(url) {
        if (!url) {
            return "";
        }
        try {
            var parsed = new URL(url, window.location.href);
            if (parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === window.location.protocol) {
                return parsed.href;
            }
        } catch (e) {
            // ignore
        }
        // Fallback: allow relative paths that don't start with javascript:
        if (/^\s*javascript:/i.test(String(url))) {
            return "";
        }
        return String(url);
    }

    function sanitizeAnchor(value) {
        if (!value) {
            return "";
        }
        // Allow typical element id characters
        var str = String(value).replace(/[^a-zA-Z0-9_-]/g, "");
        return str.substring(0, 100);
    }

    function formatTimestamp(value) {
        if (!value) {
            return "";
        }
        var date = new Date(value);
        if (isNaN(date.getTime())) {
            return "";
        }
        return date.toLocaleString();
    }

    function parseCookieKey(key) {
        var prefix = "noodle_";
        if (!key || key.indexOf(prefix) !== 0) {
            return null;
        }
        var remainder = key.substring(prefix.length);
        if (!remainder) {
            return null;
        }
        var lastUnderscore = remainder.lastIndexOf("_");
        var sectionId, courseId;

        if (lastUnderscore === -1) {
            try {
                sectionId = validateId(decodeURIComponent(remainder), 100);
            } catch (e) {
                sectionId = "";
            }
            return {
                sectionId: sectionId,
                courseId: ""
            };
        }

        var sectionPart = remainder.substring(0, lastUnderscore);
        var coursePart = remainder.substring(lastUnderscore + 1);

        try {
            sectionId = validateId(decodeURIComponent(sectionPart), 100);
            courseId = validateId(decodeURIComponent(coursePart), 100);
        } catch (e) {
            sectionId = "";
            courseId = "";
        }

        return {
            sectionId: sectionId,
            courseId: courseId
        };
    }

    function getAllNoodleCookies() {
        if (!document.cookie) {
            return [];
        }
        var pieces = document.cookie.split(";");
        var entries = [];
        for (var i = 0; i < pieces.length; i++) {
            var raw = pieces[i];
            if (!raw) {
                continue;
            }
            var trimmed = raw.trim();
            var eqIndex = trimmed.indexOf("=");
            if (eqIndex === -1) {
                continue;
            }
            var key = trimmed.substring(0, eqIndex);
            if (key.indexOf("noodle_") !== 0) {
                continue;
            }
            var value = trimmed.substring(eqIndex + 1);
            var parsedKey = parseCookieKey(key);
            if (!parsedKey) {
                continue;
            }
            var parsedValue = parseSavedValue(value);
            entries.push({
                courseId: parsedKey.courseId || "",
                sectionId: parsedKey.sectionId || "",
                data: parsedValue
            });
        }
        return entries;
    }

    function collectCourseNotes(courseId) {
        var sections = {};
        var sectionOrder = [];
        var allCookies = getAllNoodleCookies();
        var courseName = "";
        for (var i = 0; i < allCookies.length; i++) {
            var entry = allCookies[i];
            if ((entry.courseId || "") !== courseId) {
                continue;
            }
            var sectionId = entry.sectionId;
            if (!sectionId) {
                continue;
            }
            if (!sections[sectionId]) {
                sections[sectionId] = {
                    id: sectionId,
                    title: sectionId,
                    text: "",
                    savedAt: "",
                    pageUrl: "",
                    anchorId: ""
                };
                sectionOrder.push(sectionId);
            }
            if (entry.data && typeof entry.data.text === "string") {
                sections[sectionId].text = entry.data.text;
                if (entry.data.savedAt) {
                    sections[sectionId].savedAt = entry.data.savedAt;
                }
                if (entry.data.pageUrl) {
                    sections[sectionId].pageUrl = entry.data.pageUrl;
                }
                if (entry.data.anchorId) {
                    sections[sectionId].anchorId = entry.data.anchorId;
                }
                if (entry.data.sectionTitle) {
                    sections[sectionId].title = entry.data.sectionTitle;
                }
            }
            if (entry.data && entry.data.courseName && !courseName) {
                courseName = entry.data.courseName;
            }
        }

        var courseEntry = courseRegistry[courseId];
        if (courseEntry && courseEntry.forms.length) {
            if (!courseName && courseEntry.courseName) {
                courseName = courseEntry.courseName;
            }
            for (var j = 0; j < courseEntry.forms.length; j++) {
                var form = courseEntry.forms[j];
                if (!form) {
                    continue;
                }
                var sectionIdFromForm = validateId(form.getAttribute("data-sectionid"), 100);
                if (!sectionIdFromForm) {
                    continue;
                }
                var sectionTitle = validateAttributeValue(
                    form.getAttribute("data-sectiontitle") || form.getAttribute("data-sectionname"),
                    200
                );
                var textarea = form.querySelector("textarea");
                var noteText = textarea ? (textarea.value || "") : "";
                var savedAtAttr = form.getAttribute("data-savedat") || "";
                var pageUrl = sanitizeUrl(form.getAttribute("data-pageurl")) || sanitizeUrl(window.location.href);
                var anchorId = sanitizeAnchor((textarea && textarea.id) || form.getAttribute("data-pageanchor"));
                if (!sections[sectionIdFromForm]) {
                    sections[sectionIdFromForm] = {
                        id: sectionIdFromForm,
                        title: sectionTitle || sectionIdFromForm,
                        text: noteText,
                        savedAt: savedAtAttr,
                        pageUrl: pageUrl,
                        anchorId: anchorId
                    };
                    sectionOrder.push(sectionIdFromForm);
                } else {
                    sections[sectionIdFromForm].text = noteText;
                    if (savedAtAttr) {
                        sections[sectionIdFromForm].savedAt = savedAtAttr;
                    }
                    if (sectionTitle) {
                        sections[sectionIdFromForm].title = sectionTitle;
                    }
                    if (pageUrl && !sections[sectionIdFromForm].pageUrl) {
                        sections[sectionIdFromForm].pageUrl = pageUrl;
                    }
                    if (anchorId && !sections[sectionIdFromForm].anchorId) {
                        sections[sectionIdFromForm].anchorId = anchorId;
                    }
                }
            }
        }

        var seen = {};
        var uniqueOrder = [];
        for (var k = 0; k < sectionOrder.length; k++) {
            var key = sectionOrder[k];
            if (key && !seen[key]) {
                seen[key] = true;
                uniqueOrder.push(key);
            }
        }
        uniqueOrder.sort(function (aKey, bKey) {
            var aSection = sections[aKey] || {};
            var bSection = sections[bKey] || {};
            var aTime = Date.parse(aSection.savedAt || "");
            var bTime = Date.parse(bSection.savedAt || "");
            if (!isFinite(aTime)) {
                aTime = 0;
            }
            if (!isFinite(bTime)) {
                bTime = 0;
            }
            if (aTime !== bTime) {
                return bTime - aTime;
            }
            var aLabel = (aSection.title || aSection.id || "").toLowerCase();
            var bLabel = (bSection.title || bSection.id || "").toLowerCase();
            if (aLabel < bLabel) {
                return -1;
            }
            if (aLabel > bLabel) {
                return 1;
            }
            return 0;
        });

        if (!uniqueOrder.length) {
            return {
                markdown: "",
                filenameBase: courseName || (courseEntry && courseEntry.courseName) || ("course-" + courseId)
            };
        }

        var effectiveCourseName = courseName || (courseEntry && courseEntry.courseName) || ("Course " + courseId);
        var lines = ["# " + escapeHtml(effectiveCourseName), ""];
        var sectionsList = [];
        for (var m = 0; m < uniqueOrder.length; m++) {
            var sectionData = sections[uniqueOrder[m]];
            if (!sectionData) {
                continue;
            }
            var heading = "## " + escapeHtml(sectionData.title || sectionData.id || ("Section " + (m + 1)));
            lines.push(heading);
            lines.push("");
            if (sectionData.savedAt) {
                var formatted = formatTimestamp(sectionData.savedAt);
                if (formatted) {
                    lines.push("_Last saved: " + escapeHtml(formatted) + "_");
                    lines.push("");
                }
            }
            var text = sectionData.text ? escapeHtml(sectionData.text) : "_(no notes yet)_";
            lines.push(text);
            lines.push("");
            var rawText = sectionData.text || "";
            if (rawText.trim().length) {
                sectionsList.push({
                    id: sectionData.id,
                    title: sectionData.title || sectionData.id,
                    text: rawText,
                    savedAt: sectionData.savedAt || "",
                    pageUrl: sectionData.pageUrl || "",
                    anchorId: sectionData.anchorId || ""
                });
            }
        }
        return {
            markdown: lines.join("\n"),
            filenameBase: effectiveCourseName,
            courseName: effectiveCourseName,
            sections: sectionsList
        };
    }

    function triggerDownload(filename, content) {
        var blob = new Blob([content], { type: "text/markdown" });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function collectKnownCourseIds() {
        var seen = {};
        var keys = Object.keys(courseRegistry);
        for (var i = 0; i < keys.length; i++) {
            if (keys[i]) {
                seen[keys[i]] = true;
            }
        }
        var cookieEntries = getAllNoodleCookies();
        for (var j = 0; j < cookieEntries.length; j++) {
            var cid = cookieEntries[j].courseId;
            if (cid) {
                seen[cid] = true;
            }
        }
        return Object.keys(seen);
    }

    function chooseCourseId(preferredId) {
        var courseIds = collectKnownCourseIds();
        if (!courseIds.length) {
            return null;
        }
        if (preferredId && courseRegistry[preferredId]) {
            return preferredId;
        }
        if (courseIds.length === 1) {
            return courseIds[0];
        }
        var choice = window.prompt("Enter the course ID to use (" + courseIds.join(", ") + "):", courseIds[0]);
        if (!choice || !courseRegistry[choice]) {
            return null;
        }
        return choice;
    }

    function exportNotes(targetCourseId) {
        var courseId = chooseCourseId(targetCourseId);
        if (!courseId) {
            alert("No notes available to export.");
            return;
        }
        var courseEntry = courseRegistry[courseId];
        var noteBundle = collectCourseNotes(courseId);
        var markdown = noteBundle.markdown;
        if (!markdown) {
            alert("Nothing to export.");
            return;
        }
        var fallbackName = (courseEntry && courseEntry.courseName) ? courseEntry.courseName : ("course-" + courseId);
        var filenameBase = noteBundle.filenameBase || fallbackName;
        var filename = sanitizeFileName(filenameBase) + "-notes.md";
        triggerDownload(filename, markdown);
    }

    var notesModal = null;
    var lastNKeyTime = 0;
    var hotkeysAttached = false;

    function buildNotesModal() {
        if (notesModal) {
            return notesModal;
        }
        var overlay = document.createElement("div");
        overlay.id = "noodle-notes-overlay";
        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.background = "rgba(0,0,0,0.45)";
        overlay.style.zIndex = "2000";
        overlay.style.display = "none";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "noodle-notes-title");

        var container = document.createElement("div");
        container.style.background = "#fff";
        container.style.color = "#111";
        container.style.borderRadius = "12px";
        container.style.maxWidth = "720px";
        container.style.width = "90%";
        container.style.maxHeight = "80vh";
        container.style.overflow = "hidden";
        container.style.boxShadow = "0 18px 48px rgba(0,0,0,0.25)";
        container.style.display = "flex";
        container.style.flexDirection = "column";

        var header = document.createElement("div");
        header.style.padding = "16px 20px";
        header.style.borderBottom = "1px solid rgba(0,0,0,0.08)";
        header.style.display = "flex";
        header.style.justifyContent = "space-between";
        header.style.alignItems = "center";

        var titleWrap = document.createElement("div");
        var title = document.createElement("h2");
        title.id = "noodle-notes-title";
        title.textContent = "Noodle Notes";
        title.style.margin = "0";
        title.style.fontSize = "1.25rem";
        var subtitle = document.createElement("div");
        subtitle.id = "noodle-notes-course";
        subtitle.style.fontSize = "0.9rem";
        subtitle.style.color = "#555";
        titleWrap.appendChild(title);
        titleWrap.appendChild(subtitle);

        var closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.textContent = "×";
        closeBtn.setAttribute("aria-label", "Close notes");
        closeBtn.style.border = "none";
        closeBtn.style.background = "transparent";
        closeBtn.style.fontSize = "1.5rem";
        closeBtn.style.cursor = "pointer";
        closeBtn.style.lineHeight = "1";
        closeBtn.style.width = "36px";
        closeBtn.style.height = "36px";
        closeBtn.style.display = "flex";
        closeBtn.style.alignItems = "center";
        closeBtn.style.justifyContent = "center";
        closeBtn.style.borderRadius = "50%";
        closeBtn.style.transition = "background 0.2s ease";
        closeBtn.style.color = "#111";
        closeBtn.style.fontWeight = "700";
        closeBtn.addEventListener("mouseover", function () {
            this.style.background = "rgba(0,0,0,0.08)";
        });
        closeBtn.addEventListener("mouseout", function () {
            this.style.background = "transparent";
        });
        closeBtn.addEventListener("click", function () {
            overlay.style.display = "none";
        });

        header.appendChild(titleWrap);
        header.appendChild(closeBtn);

        var body = document.createElement("div");
        body.style.padding = "12px 20px 20px";
        body.style.overflowY = "auto";
        body.style.flex = "1";

        var actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.justifyContent = "space-between";
        actions.style.alignItems = "center";
        actions.style.marginBottom = "12px";

        var summary = document.createElement("div");
        summary.id = "noodle-notes-summary";
        summary.style.fontSize = "0.95rem";
        summary.style.color = "#444";

        var exportBtn = document.createElement("button");
        exportBtn.type = "button";
        exportBtn.textContent = "Export Notes";
        exportBtn.className = "btn btn-primary btn-sm";
        exportBtn.addEventListener("click", function () {
            var courseId = exportBtn.getAttribute("data-courseid");
            exportNotes(courseId);
        });

        actions.appendChild(summary);
        actions.appendChild(exportBtn);

        var list = document.createElement("div");
        list.id = "noodle-notes-list";
        list.style.display = "grid";
        list.style.gap = "12px";

        body.appendChild(actions);
        body.appendChild(list);

        container.appendChild(header);
        container.appendChild(body);
        overlay.appendChild(container);
        overlay.addEventListener("click", function (event) {
            if (event.target === overlay) {
                overlay.style.display = "none";
            }
        });
        document.body.appendChild(overlay);

        notesModal = {
            overlay: overlay,
            subtitle: subtitle,
            summary: summary,
            list: list,
            exportBtn: exportBtn
        };
        return notesModal;
    }

    function renderNotesModal(courseId) {
        var modal = buildNotesModal();
        var chosenCourseId = chooseCourseId(courseId);
        if (!chosenCourseId) {
            alert("No notes available yet.");
            return;
        }
        var bundle = collectCourseNotes(chosenCourseId);
        modal.exportBtn.setAttribute("data-courseid", chosenCourseId);
        modal.subtitle.textContent = bundle.courseName ? bundle.courseName + " (" + chosenCourseId + ")" : "Course " + chosenCourseId;
        modal.list.innerHTML = "";

        var nonEmptySections = [];
        for (var s = 0; s < bundle.sections.length; s++) {
            var sec = bundle.sections[s];
            if (sec && typeof sec.text === "string" && sec.text.trim().length) {
                nonEmptySections.push(sec);
            }
        }

        if (!nonEmptySections.length) {
            modal.summary.textContent = "No saved notes yet.";
            var empty = document.createElement("p");
            empty.textContent = "Start typing in any note field to see it here.";
            empty.style.color = "#555";
            modal.list.appendChild(empty);
            modal.overlay.style.display = "flex";
            return;
        } else {
            modal.summary.textContent = "Saved sections: " + nonEmptySections.length;
            var firstLink = null;
            for (var i = 0; i < nonEmptySections.length; i++) {
                var section = nonEmptySections[i];
                var card = document.createElement("div");
                card.style.border = "1px solid rgba(0,0,0,0.08)";
                card.style.borderRadius = "10px";
                card.style.padding = "12px 14px";
                card.style.background = "#f8f9fb";

                var title = document.createElement("div");
                title.style.fontWeight = "600";
                title.textContent = section.title || section.id;

                var meta = document.createElement("div");
                meta.style.fontSize = "0.85rem";
                meta.style.color = "#555";
                var savedText = section.savedAt ? ("Last saved: " + (formatTimestamp(section.savedAt) || section.savedAt)) : "Not saved yet";
                meta.textContent = savedText;

                var preview = document.createElement("div");
                preview.style.fontSize = "0.9rem";
                preview.style.color = "#333";
                preview.style.marginTop = "6px";
                var snippet = section.text || "";
                if (snippet.length > 100) {
                    snippet = snippet.substring(0, 100) + "…";
                }
                preview.textContent = snippet;

                var linkWrap = document.createElement("div");
                linkWrap.style.marginTop = "6px";
                var link = document.createElement("a");
                link.textContent = "Open section";
                var safeUrl = sanitizeUrl(section.pageUrl) || sanitizeUrl(window.location.href) || window.location.href;
                var anchor = section.anchorId ? "#" + section.anchorId : "";
                link.href = safeUrl + anchor;
                link.target = "_self";
                link.rel = "noopener noreferrer";
                link.style.fontSize = "0.9rem";
                link.addEventListener("click", function () {
                    modal.overlay.style.display = "none";
                });
                linkWrap.appendChild(link);
                if (!firstLink) {
                    firstLink = link;
                }

                card.appendChild(title);
                card.appendChild(meta);
                card.appendChild(preview);
                card.appendChild(linkWrap);
                modal.list.appendChild(card);
            }
            modal.overlay.style.display = "flex";
            if (firstLink && typeof firstLink.focus === "function") {
                setTimeout(function () {
                    firstLink.focus();
                }, 0);
            }
        }
    }

    function handleKeydown(event) {
        // Close with Escape if modal is open
        if (event.key === "Escape") {
            if (notesModal && notesModal.overlay && notesModal.overlay.style.display === "flex") {
                notesModal.overlay.style.display = "none";
                event.preventDefault();
            }
            return;
        }

        // Double-tap "n" to open modal (ignoring modifier keys and form fields)
        if (event.key === "n" || event.key === "N") {
            if (event.metaKey || event.ctrlKey || event.altKey) {
                return;
            }
            var target = event.target;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
                return;
            }
            var now = Date.now();
            if (now - lastNKeyTime <= 400) {
                lastNKeyTime = 0;
                renderNotesModal();
                event.preventDefault();
            } else {
                lastNKeyTime = now;
            }
        }
    }

    function ensureHotkeys() {
        if (hotkeysAttached) {
            return;
        }
        document.addEventListener("keydown", handleKeydown);
        hotkeysAttached = true;
    }

    function createNotesButton() {
        if (!document.body) {
            return;
        }
        var button = document.createElement("button");
        button.type = "button";
        button.id = "noodle-notes-button";
        button.textContent = "Noodle Notes";
        button.setAttribute("aria-label", "Open Noodle notes and export options");
        button.setAttribute("title", "Open Noodle notes and export options");
        button.style.position = "fixed";
        button.style.bottom = "16px";
        button.style.left = "16px";
        button.style.zIndex = "1050";
        button.style.padding = "10px 16px";
        button.style.border = "1px solid #0d6efd";
        button.style.background = "#0d6efd";
        button.style.color = "#fff";
        button.style.borderRadius = "999px";
        button.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
        button.style.cursor = "pointer";
        button.style.fontWeight = "600";

        button.addEventListener("focus", function() {
            this.style.outline = "3px solid #ffbf47";
            this.style.outlineOffset = "2px";
        });

        button.addEventListener("blur", function() {
            this.style.outline = "";
            this.style.outlineOffset = "";
        });

        button.addEventListener("click", function () {
            renderNotesModal();
        });
        document.body.appendChild(button);
    }

    function parseSavedValue(saved) {
        if (!saved) {
            return null;
        }

        var decoded;
        try {
            decoded = decodeURIComponent(saved);
        } catch (e) {
            console.warn("URI decode failed, using raw value");
            decoded = saved;
        }

        if (!decoded) {
            return Object.create(null, {
                text: { value: "", writable: true, enumerable: true }
            });
        }

        // Try to parse as JSON
        try {
            var parsed = JSON.parse(decoded);

            // Validate structure - reject if not a plain object
            if (!parsed || typeof parsed !== "object") {
                throw new Error("Invalid object structure");
            }

            // Reject if contains dangerous properties (prototype pollution defense)
            // Check if these properties are OWN properties (not inherited)
            if (Object.prototype.hasOwnProperty.call(parsed, "__proto__") ||
                Object.prototype.hasOwnProperty.call(parsed, "constructor") ||
                Object.prototype.hasOwnProperty.call(parsed, "prototype")) {
                console.warn("Potentially malicious object structure detected - has dangerous own properties");
                throw new Error("Dangerous properties detected");
            }

            // Check for unexpected keys (security audit)
            var allowedKeys = ["text", "courseName", "savedAt", "pageUrl", "anchorId", "sectionTitle"];
            var keys = Object.keys(parsed);
            for (var i = 0; i < keys.length; i++) {
                if (allowedKeys.indexOf(keys[i]) === -1) {
                    console.warn("Unexpected key in saved data:", keys[i]);
                }
            }

            // Create clean object without prototype chain
            // This prevents prototype pollution attacks
            var cleanObj = Object.create(null);

            // Validate and copy only expected properties with type checking
            if (parsed.text !== undefined) {
                if (typeof parsed.text === "string") {
                    var textValue = parsed.text;

                    // Handle legacy double-encoded JSON (migration path)
                    // Check if the text value itself is a JSON string
                    if (textValue.charAt(0) === "{" && textValue.charAt(textValue.length - 1) === "}") {
                        try {
                            var innerParsed = JSON.parse(textValue);
                            if (innerParsed && typeof innerParsed === "object" && typeof innerParsed.text === "string") {
                                console.warn("Migrating double-encoded legacy data");
                                textValue = innerParsed.text;
                                // Also migrate other fields if they exist
                                if (typeof innerParsed.courseName === "string") {
                                    parsed.courseName = innerParsed.courseName;
                                }
                                if (typeof innerParsed.savedAt === "string") {
                                    parsed.savedAt = innerParsed.savedAt;
                                }
                            }
                        } catch (e) {
                            // Not double-encoded JSON, just text that happens to start with {
                        }
                    }

                    cleanObj.text = validateNoteText(textValue, 5000);
                } else {
                    console.warn("Invalid text type:", typeof parsed.text);
                    cleanObj.text = "";
                }
            } else {
                // Ensure text property always exists
                cleanObj.text = "";
            }

            if (parsed.courseName !== undefined) {
                if (typeof parsed.courseName === "string") {
                    cleanObj.courseName = validateAttributeValue(parsed.courseName, 200);
                } else {
                    console.warn("Invalid courseName type:", typeof parsed.courseName);
                }
            }

            if (parsed.savedAt !== undefined) {
                if (typeof parsed.savedAt === "string") {
                    // Validate ISO 8601 date format
                    var isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
                    if (isoDatePattern.test(parsed.savedAt)) {
                        cleanObj.savedAt = parsed.savedAt;
                    } else {
                        console.warn("Invalid date format:", parsed.savedAt);
                    }
                } else {
                    console.warn("Invalid savedAt type:", typeof parsed.savedAt);
                }
            }

            if (parsed.pageUrl !== undefined) {
                if (typeof parsed.pageUrl === "string") {
                    var safeUrl = sanitizeUrl(parsed.pageUrl);
                    if (safeUrl) {
                        cleanObj.pageUrl = safeUrl;
                    }
                } else {
                    console.warn("Invalid pageUrl type:", typeof parsed.pageUrl);
                }
            }

            if (parsed.anchorId !== undefined) {
                if (typeof parsed.anchorId === "string") {
                    var anchor = sanitizeAnchor(parsed.anchorId);
                    if (anchor) {
                        cleanObj.anchorId = anchor;
                    }
                } else {
                    console.warn("Invalid anchorId type:", typeof parsed.anchorId);
                }
            }

            if (parsed.sectionTitle !== undefined) {
                if (typeof parsed.sectionTitle === "string") {
                    var secTitle = validateAttributeValue(parsed.sectionTitle, 200);
                    if (secTitle) {
                        cleanObj.sectionTitle = secTitle;
                    }
                } else {
                    console.warn("Invalid sectionTitle type:", typeof parsed.sectionTitle);
                }
            }

            // Return object that's truthy and has accessible properties
            return cleanObj;

        } catch (e) {
            // Not valid JSON or validation failed - treat as legacy plain text
            console.warn("JSON parse/validation failed:", e.message);
            return Object.create(null, {
                text: { value: decoded.substring(0, 5000), writable: true, enumerable: true }
            });
        }
    }

    function ensureStatusElement(form) {
        var status = form.querySelector(".noodle-status");
        if (!status) {
            status = document.createElement("small");
            status.className = "noodle-status text-muted d-block mt-1";
            status.setAttribute("role", "status");
            status.setAttribute("aria-live", "polite");
            status.setAttribute("aria-atomic", "true");
            form.appendChild(status);
        }
        return status;
    }

    function ensureCharacterCounter(form, textarea) {
        var counter = form.querySelector(".noodle-char-counter");
        if (!counter) {
            counter = document.createElement("small");
            counter.className = "noodle-char-counter text-muted d-block mt-1";
            counter.setAttribute("aria-live", "polite");
            counter.setAttribute("aria-atomic", "true");
            form.appendChild(counter);
        }
        return counter;
    }

    function updateCharacterCounter(textarea, counter, sectionTitle, sectionId) {
        var currentLength = textarea.value.length;
        var maxLength = parseInt(textarea.getAttribute("maxlength"), 10) || 5000;
        var remaining = maxLength - currentLength;

        // Calculate estimated cookie size
        var testPayload = {
            text: textarea.value,
            courseName: "B.C. Provincial Government Essentials",
            savedAt: new Date().toISOString(),
            pageUrl: sanitizeUrl(window.location.href),
            anchorId: sanitizeAnchor(textarea.id || ""),
            sectionTitle: sectionTitle || sectionId
        };
        var estimatedSize = encodeURIComponent(JSON.stringify(testPayload)).length;
        var cookieLimit = 4096;
        var percentUsed = Math.round((estimatedSize / cookieLimit) * 100);

        // Update counter text and styling based on usage
        var counterText = currentLength + " / " + maxLength + " characters";

        if (estimatedSize > cookieLimit) {
            counter.className = "noodle-char-counter text-danger d-block mt-1 fw-bold";
            counter.textContent = counterText + " (⚠️ Cookie limit exceeded! Note may not save.)";
        } else if (percentUsed >= 90) {
            counter.className = "noodle-char-counter text-warning d-block mt-1 fw-bold";
            counter.textContent = counterText + " (⚠️ " + percentUsed + "% of cookie limit used)";
        } else if (percentUsed >= 75) {
            counter.className = "noodle-char-counter text-warning d-block mt-1";
            counter.textContent = counterText + " (" + percentUsed + "% of cookie limit used)";
        } else {
            counter.className = "noodle-char-counter text-muted d-block mt-1";
            counter.textContent = counterText;
        }
    }

    function initForm(form) {
        var textarea = form.querySelector("textarea");
        if (!textarea) {
            return;
        }

        // Add maxlength attribute to textarea for client-side validation
        if (!textarea.hasAttribute("maxlength")) {
            textarea.setAttribute("maxlength", "5000");
        }

        var courseNameInput = form.querySelector('input[type="hidden"][name="course-name"]');
        var sectionTitle = validateAttributeValue(
            form.getAttribute("data-sectiontitle") || form.getAttribute("data-sectionname"),
            200
        );

        // Use strict ID validation (alphanumeric, hyphens, underscores only)
        var courseId = validateId(form.getAttribute("data-courseid"), 100);
        var sectionId = validateId(form.getAttribute("data-sectionid"), 100);
        if (!courseId || !sectionId) {
            console.warn("Invalid or missing course/section ID. Form will not be initialized.");
            return;
        }
        var courseEntry = ensureCourseEntry(courseId);
        if (courseEntry.forms.indexOf(form) === -1) {
            courseEntry.forms.push(form);
        }
        if (courseNameInput && courseNameInput.value && !courseEntry.courseName) {
            courseEntry.courseName = courseNameInput.value;
        }

        var cookieKey = makeKey(courseId, sectionId);
        var savedRaw = getCookie(cookieKey);
        var savedData = parseSavedValue(savedRaw);

        if (savedData && "text" in savedData && typeof savedData.text === "string") {
            textarea.value = savedData.text;
            if (courseNameInput && savedData.courseName && !courseNameInput.value) {
                courseNameInput.value = savedData.courseName;
            }
            if (savedData.courseName && !courseEntry.courseName) {
                courseEntry.courseName = savedData.courseName;
            }
            if (savedData.savedAt) {
                form.setAttribute("data-savedat", savedData.savedAt);
            }
            if (savedData.pageUrl) {
                form.setAttribute("data-pageurl", savedData.pageUrl);
            }
            if (savedData.anchorId) {
                form.setAttribute("data-pageanchor", savedData.anchorId);
            }
            if (savedData.sectionTitle) {
                sectionTitle = savedData.sectionTitle;
                form.setAttribute("data-sectiontitle", savedData.sectionTitle);
            }
        }

        var statusEl = ensureStatusElement(form);
        if (statusEl && savedRaw) {
            var formattedLoad = savedData && savedData.savedAt ? formatTimestamp(savedData.savedAt) : "";
            // textContent is safe from XSS, but we validate the timestamp format
            statusEl.textContent = formattedLoad ? "Loaded saved note from " + formattedLoad + "." : "Loaded saved note.";
        }

        // Add character counter
        var charCounter = ensureCharacterCounter(form, textarea);
        updateCharacterCounter(textarea, charCounter, sectionTitle, sectionId);

        // Auto-save functionality
        var autoSaveTimeout = null;
        var autoSaveDelay = 2000; // 2 seconds after user stops typing

        function saveNote() {
            var timestamp = new Date().toISOString();
            var payload = {
                text: validateNoteText(textarea.value || "", 5000),
                courseName: courseNameInput ? validateAttributeValue(courseNameInput.value || "", 200) : "",
                savedAt: timestamp,
                pageUrl: sanitizeUrl(window.location.href),
                anchorId: sanitizeAnchor(textarea.id || ""),
                sectionTitle: sectionTitle || sectionId
            };
            var serialized;
            try {
                serialized = encodeURIComponent(JSON.stringify(payload));
            } catch (e) {
                serialized = encodeURIComponent(payload.text);
            }
            if (payload.courseName) {
                courseEntry.courseName = payload.courseName;
            }
            form.setAttribute("data-savedat", timestamp);
            if (payload.pageUrl) {
                form.setAttribute("data-pageurl", payload.pageUrl);
            }
            setCookie(cookieKey, serialized, 365);
            if (statusEl) {
                var formatted = formatTimestamp(timestamp);
                statusEl.textContent = formatted ? "Notes saved successfully at " + formatted + "." : "Notes saved successfully.";
            }
        }

        // Update counter and trigger auto-save on input
        textarea.addEventListener("input", function () {
            updateCharacterCounter(textarea, charCounter, sectionTitle, sectionId);

            // Clear existing timeout
            if (autoSaveTimeout) {
                clearTimeout(autoSaveTimeout);
            }

            // Show "saving..." status
            if (statusEl) {
                statusEl.textContent = "Typing...";
            }

            // Set new timeout for auto-save
            autoSaveTimeout = setTimeout(function () {
                saveNote();
            }, autoSaveDelay);
        });

        // Manual save via form submit
        form.addEventListener("submit", function (event) {
            event.preventDefault();

            // Clear any pending auto-save
            if (autoSaveTimeout) {
                clearTimeout(autoSaveTimeout);
            }

            // Save immediately
            saveNote();
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        var noodleForms = document.querySelectorAll("form.noodle[data-courseid][data-sectionid]");
        for (var i = 0; i < noodleForms.length; i++) {
            initForm(noodleForms[i]);
        }
        if (noodleForms.length) {
            createNotesButton();
        }
        ensureHotkeys();
    });
})();
