#targetengine "LinksToPSDPanel"

var myPanel = (function() {
    // Create main window
    var myWindow = new Window("palette", "Links to PSD Converter", undefined);
    myWindow.orientation = "column";
    myWindow.alignChildren = ["fill", "top"];
    myWindow.spacing = 10;
    myWindow.margins = 16;

    // Add global convert button at top
    var convertAllBtn = myWindow.add("button", undefined, "Convert All to PSD + Relink");
    
    // Add list container
    var listContainer = myWindow.add("listbox", undefined, [], {
        multiselect: false,
        numberOfColumns: 2,
        showHeaders: true,
        columnTitles: ["File Name", "Page"]
    });
    listContainer.preferredSize = [400, 300];

    // Add progress bar at bottom
    var progressBar = myWindow.add("progressbar", undefined, 0, 100);
    progressBar.preferredSize = [400, 10];
    
    // Add status text below progress bar
    var statusText = myWindow.add("statictext", undefined, "");
    statusText.preferredSize = [400, 20];

    function updateLinksList() {
        // Clear existing items
        listContainer.removeAll();
        progressBar.value = 0;
        statusText.text = "";
        
        if (!app.documents.length) {
            alert("No document open");
            return;
        }
        
        var doc = app.activeDocument;
        var links = doc.links;
        var validExtensions = [".jpg", ".jpeg", ".tif", ".tiff", ".png"];
        
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var fileExt = link.name.toLowerCase().slice(link.name.lastIndexOf("."));
            
            if (validExtensions.toString().indexOf(fileExt) !== -1) {
                var pageNum = "N/A";
                try {
                    pageNum = link.parent.parent.parentPage.name;
                } catch(e) {}
                
                var item = listContainer.add("item", link.name);
                item.subItems[0].text = pageNum;
            }
        }
    }

    function convertToPSD(link, currentIndex, totalFiles, callback) {
        try {
            var bt = new BridgeTalk();
            bt.target = "photoshop";
            
            var filePath = link.filePath;
            var newPath = filePath.substring(0, filePath.lastIndexOf(".")) + ".psd";
            
            var psScript = "var doc = app.open(File('" + filePath.replace(/\\/g, '\\\\') + "'));\n";
            psScript += "doc.saveAs(File('" + newPath.replace(/\\/g, '\\\\') + "'));\n";
            psScript += "doc.close();\n";
            
            bt.body = psScript;
            
            bt.onResult = function(result) {
                try {
                    link.relink(File(newPath));
                    link.update();
                    
                    // Update progress
                    var progress = Math.round((currentIndex + 1) / totalFiles * 100);
                    progressBar.value = progress;
                    statusText.text = "Processing: " + (currentIndex + 1) + " of " + totalFiles;
                    
                    if (callback) callback();
                    
                } catch(e) {
                    alert("Error relinking: " + e);
                }
            };
            
            bt.onError = function(err) {
                alert("Error in Photoshop: " + err);
                if (callback) callback();
            };
            
            bt.send();
            
        } catch(e) {
            alert("Error: " + e);
            if (callback) callback();
        }
    }
    
    // Convert all button handler
    convertAllBtn.onClick = function() {
        if (!app.documents.length) {
            alert("No document open");
            return;
        }
        
        var doc = app.activeDocument;
        var links = doc.links;
        var validExtensions = [".jpg", ".jpeg", ".tif", ".tiff", ".png"];
        var filesToProcess = [];
        
        // Collect eligible files
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var fileExt = link.name.toLowerCase().slice(link.name.lastIndexOf("."));
            
            if (validExtensions.toString().indexOf(fileExt) !== -1) {
                filesToProcess.push(link);
            }
        }
        
        if (filesToProcess.length === 0) {
            alert("No eligible files found to convert");
            return;
        }

        // Reset progress
        progressBar.value = 0;
        statusText.text = "Starting conversion...";
        
        // Process files sequentially
        function processNextFile(index) {
            if (index >= filesToProcess.length) {
                alert("Successfully saved and relinked " + filesToProcess.length + " files");
                statusText.text = "Completed all conversions";
                updateLinksList();
                return;
            }
            
            convertToPSD(filesToProcess[index], index, filesToProcess.length, function() {
                processNextFile(index + 1);
            });
        }
        
        processNextFile(0);
    };
    
    // Update list when document changes
    app.addEventListener("afterNew", updateLinksList);
    app.addEventListener("afterOpen", updateLinksList);
    
    // Initial update
    updateLinksList();
    
    return myWindow;
})();

// Show the panel
if (myPanel instanceof Window) {
    myPanel.show();
}