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

    function buildMarkdown(courseEntry, courseId) {
        if (!courseEntry || !courseEntry.forms.length) {
            return "";
        }
        var courseName = courseEntry.courseName || ("Course " + courseId);
        var lines = ["# " + courseName, ""];
        for (var i = 0; i < courseEntry.forms.length; i++) {
            var form = courseEntry.forms[i];
            if (!form) {
                continue;
            }
            var sectionId = form.getAttribute("data-sectionid") || ("section-" + (i + 1));
            var sectionTitle = form.getAttribute("data-sectiontitle") || form.getAttribute("data-sectionname");
            var heading = "## " + (sectionTitle || sectionId);
            lines.push(heading);
            lines.push("");
            var textarea = form.querySelector("textarea");
            var noteText = textarea ? textarea.value : "";
            lines.push(noteText ? noteText : "_(no notes yet)_");
            lines.push("");
        }
        return lines.join("\n");
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
        if (!courseEntry || !courseEntry.forms.length) {
            alert("No notes found for the selected course.");
            return;
        }
        var markdown = buildMarkdown(courseEntry, targetCourseId);
        if (!markdown) {
            alert("Nothing to export.");
            return;
        }
        var filenameBase = courseEntry.courseName || ("course-" + targetCourseId);
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
