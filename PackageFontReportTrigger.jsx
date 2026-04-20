//@targetengine "session"

/*
    PackageFontReportTrigger.jsx
    Macmillan Trade Publishing - US

    PURPOSE:
        Hooks into File > Package. After the package dialog completes:
          1. Detects the newly created package folder
          2. Passes that folder path to Font Usage Report_V1.jsx via $.global
          3. Runs the Font Usage Report — which saves the CSV directly into the package folder
          4. Clears the path so normal standalone report runs save next to the document as usual

    INSTALL:
        Place this file in the same User scripts folder as "Font Usage Report_V1.jsx"
        and run it ONCE per session, OR place it in the Startup Scripts folder to auto-register:
            Mac: ~/Library/Preferences/Adobe InDesign/Version 19.0/en_US/Scripts/startup scripts/

    REQUIRES:
        Font Usage Report_V1.jsx must be the MODIFIED version that checks
        a temp file (MacmillanFontReportSavePath.txt) before saving.
*/

(function () {

    // ─── CONFIGURATION ────────────────────────────────────────────────────────
    var FONT_REPORT_PATH = File($.fileName).parent.fsName + "/Font Usage Report_V1.jsx";

    // ─── GUARD ────────────────────────────────────────────────────────────────
    if ($.global.MacmillanFontReportListenerActive === true) {
        alert("Font Report Package Trigger is already active this session.\nNo duplicate listener added.");
        return;
    }

    // ─── FIND THE PACKAGE MENU ACTION ─────────────────────────────────────────
    var packageAction;
    try {
        packageAction = app.menuActions.itemByName("$ID/Package...");
        packageAction.name;
    } catch (e) {
        alert("Could not find the Package menu action.\nError: " + e + "\n\nTrigger not installed.");
        return;
    }

    // ─── beforeInvoke: snapshot existing subfolders ───────────────────────────
    // We record what folders exist NOW so we can identify the new package folder after.
    packageAction.addEventListener("beforeInvoke", function (event) {
        if (app.documents.length === 0 || !app.activeDocument.saved) {
            $.global.MacmillanBeforeFolderSnapshot = null;
            $.global.MacmillanDocFolder = null;
            $.global.MacmillanDocNameBase = null;
            $.global.MacmillanPackageStartTime = null;
            return;
        }
        var doc = app.activeDocument;
        var docFolder = doc.filePath;
        $.global.MacmillanDocFolder = docFolder.fsName;
        $.global.MacmillanDocNameBase = stripExtension(doc.name);
        $.global.MacmillanPackageStartTime = (new Date()).getTime();
        $.global.MacmillanBeforeFolderSnapshot = getFolderNames(docFolder);
    }, false);

    // ─── afterInvoke: find new package folder, run report into it ─────────────
    packageAction.addEventListener("afterInvoke", function (event) {

        var docFolderPath = $.global.MacmillanDocFolder;
        var beforeSnapshot = $.global.MacmillanBeforeFolderSnapshot;
        var docNameBase = $.global.MacmillanDocNameBase;
        var packageStartTime = $.global.MacmillanPackageStartTime;

        // Clean up snapshot globals (keep SavePath alive until report uses it)
        $.global.MacmillanDocFolder = null;
        $.global.MacmillanBeforeFolderSnapshot = null;
        $.global.MacmillanDocNameBase = null;
        $.global.MacmillanPackageStartTime = null;

        if (!docFolderPath || !beforeSnapshot) { return; }

        var reportFile = new File(FONT_REPORT_PATH);
        if (!reportFile.exists) {
            alert(
                "Font Usage Report script not found at:\n" + reportFile.fsName +
                "\n\nPlease update FONT_REPORT_PATH in PackageFontReportTrigger.jsx."
            );
            return;
        }

        // Find package folder from event data first (most accurate when available)
        var packageFolder = findPackageFolderFromEvent(event, docNameBase, packageStartTime);

        // Then fall back to filesystem heuristics.
        var docFolder = new Folder(docFolderPath);
        if (!packageFolder) {
            packageFolder = findNewFolder(docFolder, beforeSnapshot);
        }

        // Fallback 1: pick folder that looks like an InDesign package
        if (!packageFolder) {
            packageFolder = findLikelyPackageFolder(docFolder, docNameBase, packageStartTime);
        }

        // Fallback 1b: scan common save locations for a likely package folder
        if (!packageFolder) {
            packageFolder = findLikelyPackageFolderInCommonRoots(docFolderPath, docNameBase, packageStartTime);
        }

        // Fallback 2: newest subfolder
        if (!packageFolder) {
            packageFolder = findNewestFolder(docFolder);
        }

        // Last fallback: ask user to point to the package folder so we never silently mis-save.
        if (!packageFolder) {
            packageFolder = Folder.selectDialog("Unable to auto-detect the package folder.\nSelect the new package folder for the Font Usage CSV:");
        }

        if (packageFolder) {
            var tempFile = new File(Folder.temp.fsName + "/MacmillanFontReportSavePath.txt");
            if (tempFile.open("w")) {
                tempFile.write(packageFolder.fsName);
                tempFile.close();
            }
        }

        try {
            app.doScript(
                reportFile,
                ScriptLanguage.JAVASCRIPT,
                [],
                UndoModes.ENTIRE_SCRIPT,
                "Macmillan Font Usage Report (Package Trigger)"
            );
        } catch (e) {
            alert("Font Usage Report encountered an error:\n" + e);
        }

    }, false);

    $.global.MacmillanFontReportListenerActive = true;

    alert(
        "Font Report Package Trigger is now ACTIVE.\n\n" +
        "After each File > Package, the Font Usage Report\n" +
        "will run and save the CSV inside the new package folder.\n\n" +
        "To deactivate, run RemovePackageFontReportTrigger.jsx\nor restart InDesign."
    );


    // ═══════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    function getFolderNames(folder) {
        var map = {};
        var items = folder.getFiles();
        for (var i = 0; i < items.length; i++) {
            if (items[i] instanceof Folder) {
                map[items[i].name] = true;
            }
        }
        return map;
    }

    function findNewFolder(folder, beforeMap) {
        var items = folder.getFiles();
        for (var i = 0; i < items.length; i++) {
            if (items[i] instanceof Folder && !beforeMap[items[i].name]) {
                return items[i];
            }
        }
        return null;
    }

    function findLikelyPackageFolder(folder, docBaseName, packageStartTime) {
        var items = folder.getFiles();
        var winner = null;
        var winnerScore = -1;
        var winnerTime = 0;

        for (var i = 0; i < items.length; i++) {
            if (!(items[i] instanceof Folder)) { continue; }
            var candidate = items[i];
            var score = scorePackageFolderCandidate(candidate, docBaseName, packageStartTime);
            if (score < 0) { continue; }

            var t = 0;
            try { t = candidate.modified.getTime(); } catch (_) {}

            if (score > winnerScore || (score === winnerScore && t > winnerTime)) {
                winner = candidate;
                winnerScore = score;
                winnerTime = t;
            }
        }

        return winner;
    }

    function findPackageFolderFromEvent(event, docBaseName, packageStartTime) {
        var candidates = [];
        var seen = {};

        function addFolderCandidate(val) {
            var f = normalizeToFolder(val);
            if (!f || !f.exists) return;
            var key = String(f.fsName || "");
            if (!key || seen[key]) return;
            seen[key] = true;
            candidates.push(f);
        }

        function harvest(obj) {
            if (!obj) return;
            var keys = [
                "destination", "packageFolder", "folder", "to", "path", "filePath", "fullName", "saveTo"
            ];
            for (var i = 0; i < keys.length; i++) {
                try { addFolderCandidate(obj[keys[i]]); } catch (_) {}
            }
        }

        try { harvest(event); } catch (_) {}
        try { harvest(event.target); } catch (_) {}
        try { harvest(event.parent); } catch (_) {}

        var winner = null;
        var winnerScore = -1;
        var winnerTime = 0;

        for (var i = 0; i < candidates.length; i++) {
            var root = candidates[i];

            // Candidate may be the package folder itself OR the parent destination.
            var directScore = scorePackageFolderCandidate(root, docBaseName, packageStartTime);
            if (directScore >= 0) {
                var dt = 0;
                try { dt = root.modified.getTime(); } catch (_) {}
                if (directScore > winnerScore || (directScore === winnerScore && dt > winnerTime)) {
                    winner = root;
                    winnerScore = directScore;
                    winnerTime = dt;
                }
            }

            var nested = findLikelyPackageFolder(root, docBaseName, packageStartTime);
            if (nested) {
                var ns = scorePackageFolderCandidate(nested, docBaseName, packageStartTime);
                var nt = 0;
                try { nt = nested.modified.getTime(); } catch (_) {}
                if (ns > winnerScore || (ns === winnerScore && nt > winnerTime)) {
                    winner = nested;
                    winnerScore = ns;
                    winnerTime = nt;
                }
            }
        }

        return winner;
    }

    function normalizeToFolder(val) {
        if (!val) return null;

        if (val instanceof Folder) return val;
        if (val instanceof File) return val.parent;

        var s = "";
        try { s = String(val); } catch (_) { return null; }
        if (!s) return null;

        var f;
        if (/\.(indd|indb|idml|txt|pdf)$/i.test(s)) {
            f = new File(s);
            if (f.exists) return f.parent;
            var sParent = s.replace(/[\\\/][^\\\/]+$/, "");
            if (sParent && sParent !== s) {
                var pf = new Folder(sParent);
                if (pf.exists) return pf;
            }
        }

        f = new Folder(s);
        if (f.exists) return f;
        return null;
    }

    function findLikelyPackageFolderInCommonRoots(docFolderPath, docBaseName, packageStartTime) {
        var roots = [];
        var seen = {};

        function pushRoot(folderObj) {
            if (!folderObj || !folderObj.exists) return;
            var key = String(folderObj.fsName || folderObj.fullName || "");
            if (!key || seen[key]) return;
            seen[key] = true;
            roots.push(folderObj);
        }

        pushRoot(new Folder(docFolderPath));
        try { pushRoot(Folder.desktop); } catch (_) {}
        try { pushRoot(Folder.myDocuments); } catch (_) {}
        pushRoot(new Folder("~/Downloads"));

        var winner = null;
        var winnerScore = -1;
        var winnerTime = 0;

        for (var r = 0; r < roots.length; r++) {
            var candidate = findLikelyPackageFolder(roots[r], docBaseName, packageStartTime);
            if (!candidate) continue;

            var score = scorePackageFolderCandidate(candidate, docBaseName, packageStartTime);
            var t = 0;
            try { t = candidate.modified.getTime(); } catch (_) {}

            if (score > winnerScore || (score === winnerScore && t > winnerTime)) {
                winner = candidate;
                winnerScore = score;
                winnerTime = t;
            }
        }

        return winner;
    }

    function scorePackageFolderCandidate(folder, docBaseName, packageStartTime) {
        var score = 0;
        var name = "";
        var folderTime = 0;
        var children;

        try { name = String(folder.name || "").toLowerCase(); } catch (_) {}
        try { folderTime = folder.modified.getTime(); } catch (_) {}
        try { children = folder.getFiles(); } catch (_) { return -1; }

        if (docBaseName) {
            var docLow = String(docBaseName).toLowerCase();
            if (name === docLow || name.indexOf(docLow) >= 0) score += 1;
        }

        // Typical package structure indicators
        var hasDocumentFonts = false;
        var hasLinksFolder = false;
        var hasInstructions = false;
        var hasCopiedIndd = false;

        for (var i = 0; i < children.length; i++) {
            var c = children[i];
            var cName = String(c.name || "").toLowerCase();

            if (c instanceof Folder) {
                if (cName === "document fonts") hasDocumentFonts = true;
                if (cName === "links") hasLinksFolder = true;
            } else if (c instanceof File) {
                if (cName === "instructions.txt") hasInstructions = true;
                if (/\.indd$/i.test(c.name)) hasCopiedIndd = true;
            }
        }

        if (hasDocumentFonts) score += 4;
        if (hasLinksFolder) score += 3;
        if (hasInstructions) score += 2;
        if (hasCopiedIndd) score += 2;

        // Favor folders modified during/after packaging event.
        if (packageStartTime && folderTime >= (packageStartTime - 10000)) {
            score += 2;
        }

        // Reject likely non-package folders unless there is strong evidence.
        if (score < 3) return -1;
        return score;
    }

    function findNewestFolder(folder) {
        var items = folder.getFiles();
        var newest = null;
        var newestTime = 0;
        for (var i = 0; i < items.length; i++) {
            if (items[i] instanceof Folder) {
                var t = items[i].modified.getTime();
                if (t > newestTime) { newestTime = t; newest = items[i]; }
            }
        }
        return newest;
    }

    function stripExtension(filename) {
        var n = String(filename || "");
        var idx = n.lastIndexOf(".");
        if (idx > 0) n = n.substring(0, idx);
        return n;
    }

}());


/*
    ============================================================
    COMPANION REMOVAL SCRIPT
    Copy everything below into a new file named:
        RemovePackageFontReportTrigger.jsx
    ============================================================

//@targetengine "session"

(function () {
    if ($.global.MacmillanFontReportListenerActive === true) {
        var packageAction = app.menuActions.itemByName("$ID/Package...");
        var listeners = packageAction.eventListeners;
        for (var i = listeners.length - 1; i >= 0; i--) {
            var et = listeners[i].eventType;
            if (et === "beforeInvoke" || et === "afterInvoke") {
                listeners[i].remove();
            }
        }
        $.global.MacmillanFontReportListenerActive = false;
        alert("Font Report Package Trigger has been REMOVED.");
    } else {
        alert("No active Font Report Package Trigger found in this session.");
    }
}());

    ============================================================
*/
