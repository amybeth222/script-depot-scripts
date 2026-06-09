#targetengine "SaveFileAndRelink"

(function () {
    var SCRIPT_VERSION = "v02";
    var SAVE_SUFFIX = "_production";
    var FILE_TYPE_DEFINITIONS = [
        { key: "jpeg", label: "JPEG / JPG", extensions: ["jpg", "jpeg"], defaultValue: true },
        { key: "heic", label: "HEIC / HEIF", extensions: ["heic", "heif"], defaultValue: true },
        { key: "tiff", label: "TIFF / TIF", extensions: ["tif", "tiff"], defaultValue: true },
        { key: "png", label: "PNG", extensions: ["png"], defaultValue: true },
        { key: "webp", label: "WebP", extensions: ["webp"], defaultValue: true },
        { key: "avif", label: "AVIF", extensions: ["avif"], defaultValue: true },
        { key: "gif", label: "GIF", extensions: ["gif"], defaultValue: false },
        { key: "bmp", label: "BMP", extensions: ["bmp"], defaultValue: false },
        { key: "pdf", label: "PDF", extensions: ["pdf"], defaultValue: false },
        { key: "eps", label: "EPS", extensions: ["eps"], defaultValue: false },
        { key: "other", label: "Other / unknown image formats", extensions: [], defaultValue: false }
    ];
    var KNOWN_EXTENSION_MAP = buildKnownExtensionMap();

    function buildKnownExtensionMap() {
        var map = {};
        var i;
        var j;

        for (i = 0; i < FILE_TYPE_DEFINITIONS.length; i++) {
            for (j = 0; j < FILE_TYPE_DEFINITIONS[i].extensions.length; j++) {
                map[FILE_TYPE_DEFINITIONS[i].extensions[j]] = FILE_TYPE_DEFINITIONS[i].key;
            }
        }

        return map;
    }

    function createReport() {
        return {
            converted: [],
            skipped: [],
            missing: [],
            unsupported: [],
            errors: []
        };
    }

    function addReportItem(bucket, label, message) {
        bucket.push(label + " - " + message);
    }

    function getFileExtension(fileName) {
        var lastDot = fileName.lastIndexOf(".");
        if (lastDot < 0 || lastDot === fileName.length - 1) {
            return "";
        }
        return fileName.substring(lastDot + 1).toLowerCase();
    }

    function splitFileName(fileName) {
        var lastDot = fileName.lastIndexOf(".");
        if (lastDot < 0) {
            return { baseName: fileName, extension: "" };
        }
        return {
            baseName: fileName.substring(0, lastDot),
            extension: fileName.substring(lastDot + 1)
        };
    }

    function escapeForJsString(value) {
        return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    }

    function isMissingLink(link) {
        try {
            return link.status === LinkStatus.LINK_MISSING;
        } catch (error) {
            return false;
        }
    }

    function isEmbeddedLink(link) {
        try {
            return link.status === LinkStatus.LINK_EMBEDDED;
        } catch (error) {
            return false;
        }
    }

    function getPageName(link) {
        try {
            return link.parent.parent.parentPage.name;
        } catch (error) {
            return "N/A";
        }
    }

    function getLinkLabel(link) {
        return link.name + " (page " + getPageName(link) + ")";
    }

    function getSelectedTypes(checkboxes) {
        var selected = {};
        var i;

        for (i = 0; i < checkboxes.length; i++) {
            if (checkboxes[i].value) {
                selected[checkboxes[i].fileTypeKey] = true;
            }
        }

        return selected;
    }

    function hasAnySelection(selectedTypes) {
        var key;

        for (key in selectedTypes) {
            if (selectedTypes.hasOwnProperty(key)) {
                return true;
            }
        }

        return false;
    }

    function getLinkTypeKey(link) {
        var extension = getFileExtension(link.name);
        return KNOWN_EXTENSION_MAP[extension] || "other";
    }

    function collectEligibleLinks(doc, selectedTypes, report) {
        var eligible = [];
        var links = doc.links;
        var i;

        for (i = 0; i < links.length; i++) {
            var link = links[i];
            var label = getLinkLabel(link);
            var typeKey;
            var sourceFile;

            if (isMissingLink(link)) {
                addReportItem(report.missing, label, "missing link");
                continue;
            }

            if (isEmbeddedLink(link)) {
                addReportItem(report.skipped, label, "embedded link skipped");
                continue;
            }

            typeKey = getLinkTypeKey(link);
            if (!selectedTypes[typeKey]) {
                continue;
            }

            try {
                sourceFile = File(link.filePath);
            } catch (error) {
                addReportItem(report.errors, label, "unable to resolve file path");
                continue;
            }

            if (!sourceFile || !sourceFile.exists) {
                addReportItem(report.missing, label, "source file not found on disk");
                continue;
            }

            eligible.push({
                link: link,
                label: label,
                sourceFile: sourceFile,
                sourceExtension: getFileExtension(sourceFile.name)
            });
        }

        return eligible;
    }

    function updateLinksPreview(listBox, selectedTypes) {
        var i;
        var row;
        var displayName;

        listBox.removeAll();
        if (!app.documents.length) {
            return;
        }

        for (i = 0; i < app.activeDocument.links.length; i++) {
            var link = app.activeDocument.links[i];
            var typeKey = getLinkTypeKey(link);
            var status = "Filtered";

            if (!selectedTypes[typeKey]) {
                continue;
            }

            displayName = link.name;

            if (isMissingLink(link)) {
                status = "Missing";
            } else if (isEmbeddedLink(link)) {
                status = "Embedded";
            } else {
                status = "Eligible";
                displayName = link.name;
            }

            row = listBox.add("item", displayName);
            row.linkIndex = i;

            row.subItems[0].text = getPageName(link);
            row.subItems[1].text = typeKey.toUpperCase();
            row.subItems[2].text = status;

            // Auto-select all eligible rows so production-ready links are obvious at a glance.
            if (status === "Eligible") {
                row.selected = true;
            }
        }
    }

    function collectItemsFromSelection(doc, selectedTypes, selectedRows, report) {
        var items = [];
        var links = doc.links;
        var seen = {};
        var i;

        for (i = 0; i < selectedRows.length; i++) {
            var row = selectedRows[i];
            var linkIndex = row.linkIndex;
            var link;
            var label;
            var typeKey;
            var sourceFile;

            if (typeof linkIndex !== "number" || seen[linkIndex] || linkIndex < 0 || linkIndex >= links.length) {
                continue;
            }
            seen[linkIndex] = true;

            link = links[linkIndex];
            label = getLinkLabel(link);

            if (isMissingLink(link)) {
                addReportItem(report.missing, label, "missing link");
                continue;
            }

            if (isEmbeddedLink(link)) {
                addReportItem(report.skipped, label, "embedded link skipped");
                continue;
            }

            typeKey = getLinkTypeKey(link);
            if (!selectedTypes[typeKey]) {
                addReportItem(report.skipped, label, "filtered out by file type");
                continue;
            }

            try {
                sourceFile = File(link.filePath);
            } catch (error) {
                addReportItem(report.errors, label, "unable to resolve file path");
                continue;
            }

            if (!sourceFile || !sourceFile.exists) {
                addReportItem(report.missing, label, "source file not found on disk");
                continue;
            }

            items.push({
                link: link,
                label: label,
                sourceFile: sourceFile,
                sourceExtension: getFileExtension(sourceFile.name)
            });
        }

        return items;
    }

    function buildTargetFile(sourceFile, targetExtension, allowOverwriteOriginal) {
        var parts = splitFileName(sourceFile.name);
        var normalizedExtension = targetExtension.toLowerCase();
        var basePath = sourceFile.parent.fsName + "/" + parts.baseName;
        var originalExtension = getFileExtension(sourceFile.name);
        var candidate;
        var counter;

        if (allowOverwriteOriginal && originalExtension === normalizedExtension) {
            return sourceFile;
        }

        candidate = File(basePath + "." + normalizedExtension);
        if (!candidate.exists && candidate.fsName !== sourceFile.fsName) {
            return candidate;
        }

        counter = 1;
        do {
            candidate = File(basePath + SAVE_SUFFIX + (counter > 1 ? "_" + counter : "") + "." + normalizedExtension);
            counter++;
        } while (candidate.exists && candidate.fsName !== sourceFile.fsName);

        return candidate;
    }

    function buildPhotoshopScript(sourcePath, targetPath, targetExtension) {
        var extension = targetExtension.toLowerCase();
        var script = [];

        script.push("(function () {");
        script.push("    var sourceFile = File('" + escapeForJsString(sourcePath) + "');");
        script.push("    var targetFile = File('" + escapeForJsString(targetPath) + "');");
        script.push("    if (!sourceFile.exists) { throw new Error('Source file not found: ' + sourceFile.fsName); }");
        script.push("    var doc = app.open(sourceFile);");
        script.push("    if ('" + extension + "' === 'psd') {");
        script.push("        var psdOptions = new PhotoshopSaveOptions();");
        script.push("        psdOptions.layers = true;");
        script.push("        psdOptions.embedColorProfile = true;");
        script.push("        doc.saveAs(targetFile, psdOptions, true, Extension.LOWERCASE);");
        script.push("    } else if ('" + extension + "' === 'jpg' || '" + extension + "' === 'jpeg') {");
        script.push("        var jpgOptions = new JPEGSaveOptions();");
        script.push("        jpgOptions.embedColorProfile = true;");
        script.push("        jpgOptions.quality = 10;");
        script.push("        doc.saveAs(targetFile, jpgOptions, true, Extension.LOWERCASE);");
        script.push("    } else if ('" + extension + "' === 'tif' || '" + extension + "' === 'tiff') {");
        script.push("        var tifOptions = new TiffSaveOptions();");
        script.push("        tifOptions.embedColorProfile = true;");
        script.push("        tifOptions.layers = false;");
        script.push("        doc.saveAs(targetFile, tifOptions, true, Extension.LOWERCASE);");
        script.push("    } else if ('" + extension + "' === 'png') {");
        script.push("        var pngOptions = new PNGSaveOptions();");
        script.push("        pngOptions.interlaced = false;");
        script.push("        doc.saveAs(targetFile, pngOptions, true, Extension.LOWERCASE);");
        script.push("    } else if ('" + extension + "' === 'bmp') {");
        script.push("        var bmpOptions = new BMPSaveOptions();");
        script.push("        doc.saveAs(targetFile, bmpOptions, true, Extension.LOWERCASE);");
        script.push("    } else if ('" + extension + "' === 'pdf') {");
        script.push("        var pdfOptions = new PDFSaveOptions();");
        script.push("        pdfOptions.embedColorProfile = true;");
        script.push("        doc.saveAs(targetFile, pdfOptions, true, Extension.LOWERCASE);");
        script.push("    } else if ('" + extension + "' === 'eps') {");
        script.push("        var epsOptions = new EPSSaveOptions();");
        script.push("        epsOptions.embedColorProfile = true;");
        script.push("        doc.saveAs(targetFile, epsOptions, true, Extension.LOWERCASE);");
        script.push("    } else {");
        script.push("        throw new Error('Unsupported target extension: " + extension + "');");
        script.push("    }");
        script.push("    doc.close(SaveOptions.DONOTSAVECHANGES);");
        script.push("    return targetFile.fsName;");
        script.push("}());");

        return script.join("\n");
    }

    function processLinkItem(item, report, statusText, done) {
        var targetExtension = "psd";
        var targetFile;
        var bt;

        targetFile = buildTargetFile(item.sourceFile, targetExtension, false);
        statusText.text = "Processing " + item.link.name;

        bt = new BridgeTalk();
        bt.target = "photoshop";
        bt.body = buildPhotoshopScript(item.sourceFile.fsName, targetFile.fsName, targetExtension);

        bt.onResult = function (result) {
            var relinkFile = targetFile;
            var relinkPath;

            try {
                if (result && result.body) {
                    relinkPath = String(result.body).replace(/^\s+|\s+$/g, "");
                    if (relinkPath) {
                        var returnedFile = File(relinkPath);
                        if (returnedFile.exists) {
                            relinkFile = returnedFile;
                        }
                    }
                }

                if (!relinkFile.exists) {
                    throw new Error("saved file not found");
                }
                item.link.relink(relinkFile);
                item.link.update();
                addReportItem(report.converted, item.label, "relinked to " + relinkFile.name);
            } catch (error) {
                addReportItem(report.errors, item.label, "relink failed: " + error);
            }

            done();
        };

        bt.onError = function (errorMessage) {
            var message = errorMessage && errorMessage.body ? errorMessage.body : errorMessage;
            addReportItem(report.errors, item.label, "Photoshop error: " + message);
            done();
        };

        bt.send();
    }

    function showReportDialog(report) {
        var successfulCount = report.converted.length;
        var fileLabel = successfulCount === 1 ? "file" : "files";
        alert("Resaved and relinked successfully: " + successfulCount + " " + fileLabel + ".");
    }

    function processQueue(items, report, progressBar, statusText, onComplete) {
        var index = 0;

        function next() {
            progressBar.value = index;

            if (index >= items.length) {
                statusText.text = "Completed";
                progressBar.value = items.length;
                onComplete();
                return;
            }

            processLinkItem(items[index], report, statusText, function () {
                index++;
                next();
            });
        }

        next();
    }

    function createDialog() {
        var dialog = new Window("palette", "Save File and Relink " + SCRIPT_VERSION, undefined, { closeButton: true });
        var fileTypesPanel;
        var fileTypeColumns;
        var leftColumn;
        var rightColumn;
        var toggleButtons;
        var selectAllButton;
        var deselectAllButton;
        var linksPanel;
        var linksList;
        var progressBar;
        var statusText;
        var buttonRow;
        var cancelButton;
        var runButton;
        var runAllButton;
        var checkboxes = [];
        var i;
        var definition;
        var checkbox;

        dialog.orientation = "column";
        dialog.alignChildren = ["fill", "top"];
        dialog.spacing = 12;
        dialog.margins = 16;

        fileTypesPanel = dialog.add("panel", undefined, "Files to Convert");
        fileTypesPanel.orientation = "column";
        fileTypesPanel.alignChildren = ["fill", "top"];
        fileTypesPanel.margins = 12;

        fileTypeColumns = fileTypesPanel.add("group");
        fileTypeColumns.orientation = "row";
        fileTypeColumns.alignChildren = ["left", "top"];
        fileTypeColumns.spacing = 30;

        leftColumn = fileTypeColumns.add("group");
        leftColumn.orientation = "column";
        leftColumn.alignChildren = ["left", "top"];

        rightColumn = fileTypeColumns.add("group");
        rightColumn.orientation = "column";
        rightColumn.alignChildren = ["left", "top"];

        for (i = 0; i < FILE_TYPE_DEFINITIONS.length; i++) {
            definition = FILE_TYPE_DEFINITIONS[i];
            checkbox = (i < Math.ceil(FILE_TYPE_DEFINITIONS.length / 2) ? leftColumn : rightColumn).add("checkbox", undefined, definition.label);
            checkbox.value = definition.defaultValue;
            checkbox.fileTypeKey = definition.key;
            checkboxes.push(checkbox);
        }

        toggleButtons = fileTypesPanel.add("group");
        toggleButtons.orientation = "row";
        toggleButtons.alignChildren = ["left", "center"];

        selectAllButton = toggleButtons.add("button", undefined, "Select All");
        deselectAllButton = toggleButtons.add("button", undefined, "Deselect All");

        linksPanel = dialog.add("panel", undefined, "Linked Files Preview");
        linksPanel.orientation = "column";
        linksPanel.alignChildren = ["fill", "top"];
        linksPanel.margins = 12;

        linksList = linksPanel.add("listbox", undefined, [], {
            multiselect: true,
            numberOfColumns: 4,
            showHeaders: true,
            columnTitles: ["File Name", "Page", "Type", "Status"]
        });
        linksList.preferredSize = [640, 170];

        progressBar = dialog.add("progressbar", undefined, 0, 1);
        progressBar.preferredSize = [460, 14];

        statusText = dialog.add("statictext", undefined, "Select files to process.");
        statusText.preferredSize = [460, 20];

        buttonRow = dialog.add("group");
        buttonRow.orientation = "row";
        buttonRow.alignment = ["right", "center"];

        cancelButton = buttonRow.add("button", undefined, "Cancel", { name: "cancel" });
        runButton = buttonRow.add("button", undefined, "Run Selected", { name: "ok" });
        runAllButton = buttonRow.add("button", undefined, "Run on All");

        function runItems(items, report) {
            if (!items.length) {
                statusText.text = "No eligible links to process.";
                showReportDialog(report);
                return;
            }

            progressBar.maxvalue = items.length;
            progressBar.value = 0;
            runButton.enabled = false;
            runAllButton.enabled = false;
            cancelButton.enabled = false;

            processQueue(items, report, progressBar, statusText, function () {
                runButton.enabled = true;
                runAllButton.enabled = true;
                cancelButton.enabled = true;
                showReportDialog(report);
            });
        }

        selectAllButton.onClick = function () {
            for (i = 0; i < checkboxes.length; i++) {
                checkboxes[i].value = true;
            }
            updateLinksPreview(linksList, getSelectedTypes(checkboxes));
        };

        deselectAllButton.onClick = function () {
            for (i = 0; i < checkboxes.length; i++) {
                checkboxes[i].value = false;
            }
            updateLinksPreview(linksList, getSelectedTypes(checkboxes));
        };

        for (i = 0; i < checkboxes.length; i++) {
            checkboxes[i].onClick = function () {
                updateLinksPreview(linksList, getSelectedTypes(checkboxes));
            };
        }

        updateLinksPreview(linksList, getSelectedTypes(checkboxes));

        runButton.onClick = function () {
            var report;
            var selectedTypes;
            var items;
            var selectedRows;

            if (!app.documents.length) {
                alert("No document open.");
                return;
            }

            selectedTypes = getSelectedTypes(checkboxes);
            if (!hasAnySelection(selectedTypes)) {
                alert("Select at least one file type to convert.");
                return;
            }

            report = createReport();
            selectedRows = linksList.selection;
            if (!selectedRows || selectedRows.length === 0) {
                alert("Select one or more files in the list, or use 'Run on All'.");
                return;
            }

            if (!(selectedRows instanceof Array)) {
                selectedRows = [selectedRows];
            }

            items = collectItemsFromSelection(app.activeDocument, selectedTypes, selectedRows, report);
            runItems(items, report);
        };

        runAllButton.onClick = function () {
            var report;
            var selectedTypes;
            var items;

            if (!app.documents.length) {
                alert("No document open.");
                return;
            }

            selectedTypes = getSelectedTypes(checkboxes);
            if (!hasAnySelection(selectedTypes)) {
                alert("Select at least one file type to convert.");
                return;
            }

            report = createReport();
            items = collectEligibleLinks(app.activeDocument, selectedTypes, report);
            if (!items.length) {
                statusText.text = "No eligible links matched the selected filters.";
            }
            runItems(items, report);
        };

        return dialog;
    }

    if (!app.documents.length) {
        alert("No document open.");
        return;
    }

    createDialog().show();
}());
