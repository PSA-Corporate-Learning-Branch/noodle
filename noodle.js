(function () {
    function setCookie(name, value, days) {
        var expires = "";
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + value + expires + "; path=/";
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
        if (lastUnderscore === -1) {
            return {
                sectionId: decodeURIComponent(remainder),
                courseId: ""
            };
        }
        var sectionPart = remainder.substring(0, lastUnderscore);
        var coursePart = remainder.substring(lastUnderscore + 1);
        return {
            sectionId: decodeURIComponent(sectionPart),
            courseId: decodeURIComponent(coursePart)
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
                    text: ""
                };
                sectionOrder.push(sectionId);
            }
            if (entry.data && typeof entry.data.text === "string") {
                sections[sectionId].text = entry.data.text;
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
                var sectionIdFromForm = form.getAttribute("data-sectionid");
                if (!sectionIdFromForm) {
                    continue;
                }
                var sectionTitle = form.getAttribute("data-sectiontitle") || form.getAttribute("data-sectionname");
                var textarea = form.querySelector("textarea");
                var noteText = textarea ? (textarea.value || "") : "";
                if (!sections[sectionIdFromForm]) {
                    sections[sectionIdFromForm] = {
                        id: sectionIdFromForm,
                        title: sectionTitle || sectionIdFromForm,
                        text: noteText
                    };
                    sectionOrder.push(sectionIdFromForm);
                } else {
                    sections[sectionIdFromForm].text = noteText;
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
        uniqueOrder.sort();

        if (!uniqueOrder.length) {
            return {
                markdown: "",
                filenameBase: courseName || (courseEntry && courseEntry.courseName) || ("course-" + courseId)
            };
        }

        var effectiveCourseName = courseName || (courseEntry && courseEntry.courseName) || ("Course " + courseId);
        var lines = ["# " + effectiveCourseName, ""];
        for (var m = 0; m < uniqueOrder.length; m++) {
            var sectionData = sections[uniqueOrder[m]];
            if (!sectionData) {
                continue;
            }
            var heading = "## " + (sectionData.title || sectionData.id || ("Section " + (m + 1)));
            lines.push(heading);
            lines.push("");
            var text = sectionData.text ? sectionData.text : "_(no notes yet)_";
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
        if (!saved) {
            return null;
        }
        var decoded;
        try {
            decoded = decodeURIComponent(saved);
        } catch (e) {
            decoded = saved;
        }
        if (!decoded) {
            return { text: "" };
        }
        try {
            var parsed = JSON.parse(decoded);
            if (parsed && typeof parsed === "object" && parsed.text !== undefined) {
                return parsed;
            }
        } catch (e) {
            // Ignore invalid JSON; treat as legacy plain text.
        }
        return { text: decoded };
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
        var courseNameInput = form.querySelector('input[type="hidden"][name="course-name"]');

        var courseId = form.getAttribute("data-courseid");
        var sectionId = form.getAttribute("data-sectionid");
        if (!courseId || !sectionId) {
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
        if (savedData && typeof savedData.text === "string") {
            textarea.value = savedData.text;
            if (courseNameInput && savedData.courseName && !courseNameInput.value) {
                courseNameInput.value = savedData.courseName;
            }
            if (savedData.courseName && !courseEntry.courseName) {
                courseEntry.courseName = savedData.courseName;
            }
        }

        var statusEl = ensureStatusElement(form);
        if (statusEl && savedRaw) {
            statusEl.textContent = "Loaded saved note.";
        }

        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var payload = {
                text: textarea.value || "",
                courseName: courseNameInput ? (courseNameInput.value || "") : ""
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
            setCookie(cookieKey, serialized, 365);
            if (statusEl) {
                statusEl.textContent = "Saved locally.";
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
