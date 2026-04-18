//@targetengine "session"

/*
    PackageFontReportTrigger.jsx
    Macmillan Trade Publishing - US

    PURPOSE:
        Hooks into File > Package. After the package dialog completes:
          1. Detects the newly created package folder
          2. Passes that folder path to Font Usage Report_1.2.jsx via $.global
          3. Runs the Font Usage Report — which saves the CSV directly into the package folder
          4. Clears the path so normal standalone report runs save next to the document as usual

    INSTALL:
        Place this file in the same User scripts folder as "Font Usage Report_1.2.jsx"
        and run it ONCE per session, OR place it in the Startup Scripts folder to auto-register:
            Mac: ~/Library/Preferences/Adobe InDesign/Version 19.0/en_US/Scripts/startup scripts/

    REQUIRES:
        Font Usage Report_1.2.jsx must be the MODIFIED version that checks
        a temp file (MacmillanFontReportSavePath.txt) before saving.
*/

(function () {

    // ─── CONFIGURATION ────────────────────────────────────────────────────────
    var FONT_REPORT_PATH = File($.fileName).parent.fsName + "/Font Usage Report_1.3.jsx";

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
            return;
        }
        var docFolder = app.activeDocument.filePath;
        $.global.MacmillanDocFolder = docFolder.fsName;
        $.global.MacmillanBeforeFolderSnapshot = getFolderNames(docFolder);
    }, false);

    // ─── afterInvoke: find new package folder, run report into it ─────────────
    packageAction.addEventListener("afterInvoke", function (event) {

        var docFolderPath = $.global.MacmillanDocFolder;
        var beforeSnapshot = $.global.MacmillanBeforeFolderSnapshot;

        // Clean up snapshot globals (keep SavePath alive until report uses it)
        $.global.MacmillanDocFolder = null;
        $.global.MacmillanBeforeFolderSnapshot = null;

        if (!docFolderPath || !beforeSnapshot) { return; }

        var reportFile = new File(FONT_REPORT_PATH);
        if (!reportFile.exists) {
            alert(
                "Font Usage Report script not found at:\n" + reportFile.fsName +
                "\n\nPlease update FONT_REPORT_PATH in PackageFontReportTrigger.jsx."
            );
            return;
        }

        // Find the new package folder — the one that wasn't in the snapshot
        var docFolder = new Folder(docFolderPath);
        var packageFolder = findNewFolder(docFolder, beforeSnapshot);

        // Fallback: newest subfolder
        if (!packageFolder) {
            packageFolder = findNewestFolder(docFolder);
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
