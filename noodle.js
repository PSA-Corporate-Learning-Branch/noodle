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
                    savedAt: ""
                };
                sectionOrder.push(sectionId);
            }
            if (entry.data && typeof entry.data.text === "string") {
                sections[sectionId].text = entry.data.text;
                if (entry.data.savedAt) {
                    sections[sectionId].savedAt = entry.data.savedAt;
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
                if (!sections[sectionIdFromForm]) {
                    sections[sectionIdFromForm] = {
                        id: sectionIdFromForm,
                        title: sectionTitle || sectionIdFromForm,
                        text: noteText,
                        savedAt: savedAtAttr
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
        }
        return {
            markdown: lines.join("\n"),
            filenameBase: effectiveCourseName
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

    function exportNotes() {
        var courseIds = Object.keys(courseRegistry);
        if (!courseIds.length) {
            alert("No notes available to export.");
            return;
        }
        var targetCourseId = courseIds[0];
        if (courseIds.length > 1) {
            var choice = window.prompt("Enter the course ID to export (" + courseIds.join(", ") + "):", targetCourseId);
            if (!choice) {
                return;
            }
            if (!courseRegistry[choice]) {
                alert("Course ID not found.");
                return;
            }
            targetCourseId = choice;
        }
        var courseEntry = courseRegistry[targetCourseId];
        var noteBundle = collectCourseNotes(targetCourseId);
        var markdown = noteBundle.markdown;
        if (!markdown) {
            alert("Nothing to export.");
            return;
        }
        var fallbackName = (courseEntry && courseEntry.courseName) ? courseEntry.courseName : ("course-" + targetCourseId);
        var filenameBase = noteBundle.filenameBase || fallbackName;
        var filename = sanitizeFileName(filenameBase) + "-notes.md";
        triggerDownload(filename, markdown);
    }

    function createExportButton() {
        if (!document.body) {
            return;
        }
        var button = document.createElement("button");
        button.type = "button";
        button.textContent = "Export Notes";
        button.style.position = "fixed";
        button.style.bottom = "16px";
        button.style.left = "16px";
        button.style.zIndex = "1050";
        button.style.padding = "8px 14px";
        button.style.border = "1px solid #0d6efd";
        button.style.background = "#0d6efd";
        button.style.color = "#fff";
        button.style.borderRadius = "4px";
        button.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
        button.style.cursor = "pointer";
        button.addEventListener("click", exportNotes);
        document.body.appendChild(button);
    }

    function parseSavedValue(saved) {
        console.log("=== parseSavedValue called ===");
        console.log("Input (first 100 chars):", saved ? saved.substring(0, 100) : "null");

        if (!saved) {
            return null;
        }

        var decoded;
        try {
            decoded = decodeURIComponent(saved);
            console.log("Decoded (first 100 chars):", decoded.substring(0, 100));
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
            console.log("Attempting JSON.parse...");
            var parsed = JSON.parse(decoded);
            console.log("JSON.parse succeeded, result:", parsed);

            // Validate structure - reject if not a plain object
            if (!parsed || typeof parsed !== "object") {
                console.log("Failed: not a plain object");
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
            var allowedKeys = ["text", "courseName", "savedAt"];
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

                    console.log("Raw text value from parsed:", textValue);
                    console.log("First char:", textValue.charAt(0), "Last char:", textValue.charAt(textValue.length - 1));

                    // Handle legacy double-encoded JSON (migration path)
                    // Check if the text value itself is a JSON string
                    if (textValue.charAt(0) === "{" && textValue.charAt(textValue.length - 1) === "}") {
                        console.log("Detected potential double-encoded JSON, attempting parse...");
                        try {
                            var innerParsed = JSON.parse(textValue);
                            console.log("Inner parse succeeded:", innerParsed);
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
                            console.log("Inner parse failed:", e.message);
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

            // Return object that's truthy and has accessible properties
            console.log("Returning cleanObj:", cleanObj);
            console.log("cleanObj.text:", cleanObj.text);
            console.log("cleanObj keys:", Object.keys(cleanObj));
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
            form.appendChild(status);
        }
        return status;
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

        // Debug: Check what we got
        if (savedRaw) {
            console.log("Cookie raw value:", savedRaw.substring(0, 100));
        }
        if (savedData) {
            console.log("Parsed data keys:", Object.keys(savedData));
            console.log("Has text property:", "text" in savedData);
            console.log("Text value:", savedData.text);
        }

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
        }

        var statusEl = ensureStatusElement(form);
        if (statusEl && savedRaw) {
            var formattedLoad = savedData && savedData.savedAt ? formatTimestamp(savedData.savedAt) : "";
            // textContent is safe from XSS, but we validate the timestamp format
            statusEl.textContent = formattedLoad ? "Loaded saved note (" + formattedLoad + ")." : "Loaded saved note.";
        }

        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var timestamp = new Date().toISOString();
            var payload = {
                text: validateNoteText(textarea.value || "", 5000),
                courseName: courseNameInput ? validateAttributeValue(courseNameInput.value || "", 200) : "",
                savedAt: timestamp
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
            setCookie(cookieKey, serialized, 365);
            if (statusEl) {
                var formatted = formatTimestamp(timestamp);
                statusEl.textContent = formatted ? "Saved locally (" + formatted + ")." : "Saved locally.";
            }
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        var noodleForms = document.querySelectorAll("form.noodle[data-courseid][data-sectionid]");
        for (var i = 0; i < noodleForms.length; i++) {
            initForm(noodleForms[i]);
        }
        if (noodleForms.length) {
            createExportButton();
        }
    });
})();
