/************************************************************
 * Script Name: Image Resolution Upsampler.jsx
 * Created by: Amybeth Menendez
 * Description: Upscales low-resolution images in InDesign using BridgeTalk.
 * Date: June 2, 2025
 ************************************************************/



#targetengine "session"

function main() {
    // Create a dockable panel
    var myPanel = (this instanceof Panel) ? this : new Window("palette", "Image Resolution Upsampler", undefined, {resizeable: true});
    myPanel.orientation = "column";
    myPanel.alignChildren = ["fill", "top"];
    myPanel.spacing = 10;
    myPanel.margins = 16;
    
    // Add threshold input group
    var thresholdGroup = myPanel.add("group");
    thresholdGroup.orientation = "row";
    thresholdGroup.alignChildren = ["left", "center"];
    thresholdGroup.spacing = 10;
    
    var thresholdLabel = thresholdGroup.add("statictext", undefined, "Minimum Resolution Threshold (PPI):");
    var thresholdInput = thresholdGroup.add("edittext", undefined, "300");
    thresholdInput.characters = 6;
    thresholdInput.justify = "right";
    
    // Add scan button
    var scanButton = myPanel.add("button", undefined, "Scan Document");
    
    // Add results group with a scrollable list
    var resultsGroup = myPanel.add("group");
    resultsGroup.orientation = "column";
    resultsGroup.alignChildren = ["fill", "top"];
    resultsGroup.spacing = 5;
    
    var resultsLabel = resultsGroup.add("statictext", undefined, "Results:");
    
    // Create headers
    var headerGroup = resultsGroup.add("group");
    headerGroup.orientation = "row";
    
    var nameHeader = headerGroup.add("statictext", undefined, "Image Name");
    nameHeader.preferredSize.width = 200;
    var pageHeader = headerGroup.add("statictext", undefined, "Page");
    pageHeader.preferredSize.width = 50;
    var ppiHeader = headerGroup.add("statictext", undefined, "PPI");
    ppiHeader.preferredSize.width = 50;
    
    // Create results list
    var resultsList = resultsGroup.add("listbox", undefined, [], {multiselect: true});
    resultsList.preferredSize.width = 350;
    resultsList.preferredSize.height = 200;
    
    // Add summary text
    var summaryText = resultsGroup.add("statictext", undefined, "");
    summaryText.preferredSize.width = 350;
    
    // Add upsample button (disabled by default)
    var upsampleButton = myPanel.add("button", undefined, "Upsample in Photoshop");
    upsampleButton.enabled = false;
    
    // Store the low-res images for later use
    var lowResImages = [];
    
    // Event handlers
    scanButton.onClick = function() {
        // Clear previous results
        while (resultsList.items.length > 0) {
            resultsList.remove(resultsList.items[0]);
        }
        lowResImages = [];
        
        var doc = app.activeDocument;
        if (!doc) {
            alert("Please open a document first.");
            return;
        }
        
        var threshold = parseInt(thresholdInput.text);
        if (isNaN(threshold) || threshold <= 0) {
            alert("Please enter a valid threshold value.");
            return;
        }
        
        // Scan all placed graphics in the document
        scanAllGraphics(doc, threshold, resultsList, lowResImages);
        
        // Update summary
        var totalImages = lowResImages.length;
        summaryText.text = "Found " + totalImages + " image" + (totalImages !== 1 ? "s" : "") + " below " + threshold + " PPI";
        
        // Enable/disable upsample button
        upsampleButton.enabled = (totalImages > 0);
    };
    
    upsampleButton.onClick = function() {
        var targetPpi = parseInt(thresholdInput.text);
        
        // Get selected images
        var selectedIndices = [];
        var selectedImages = [];
        
        for (var i = 0; i < resultsList.items.length; i++) {
            if (resultsList.items[i].selected) {
                selectedIndices.push(i);
                selectedImages.push(lowResImages[i]);
            }
        }
        
        // If none selected, use all images
        if (selectedImages.length === 0) {
            selectedImages = lowResImages;
        }
        
        if (selectedImages.length > 0) {
            upsampleInPhotoshop(selectedImages, targetPpi);
        }
    };
    
    // Resize behavior
    myPanel.onResizing = myPanel.onResize = function() {
        this.layout.resize();
    };
    
    if (myPanel instanceof Window) {
        myPanel.center();
        myPanel.show();
    } else {
        myPanel.layout.layout(true);
        myPanel.layout.resize();
    }
    
    return myPanel;
}

function scanAllGraphics(doc, threshold, resultsList, lowResImages) {
    try {
        // Go through all placed graphics in the document
        for (var i = 0; i < doc.allGraphics.length; i++) {
            var graphic = doc.allGraphics[i];
            
            // Skip if it's not a linked item
            if (!graphic.itemLink) continue;
            
            // Get effective PPI
            var effectivePpi = getEffectivePPI(graphic);
            
            if (effectivePpi < threshold) {
                // Find which page this graphic is on
                var pageNumber = findGraphicPage(doc, graphic);
                
                // Format display strings for list item
                var displayName = graphic.itemLink.name;
                if (displayName.length > 25) {
                    displayName = displayName.substring(0, 22) + "...";
                }
                
                // Add to the list with formatted text
                var item = resultsList.add("item", displayName + " | Page " + pageNumber + " | " + Math.round(effectivePpi) + " PPI");
                
                // Store the low-res image info
                lowResImages.push({
                    graphic: graphic,
                    link: graphic.itemLink,
                    effectivePpi: effectivePpi,
                    pageNumber: pageNumber
                });
            }
        }
    } catch (e) {
        alert("Error scanning graphics: " + e);
        throw e;
    }
}

function getEffectivePPI(graphic) {
    try {
        // Get the effective PPI of the graphic
        var effectivePpi = 0;
        
        // Different property names depending on graphic type
        if (graphic.hasOwnProperty("effectivePpi")) {
            // For bitmap images
            effectivePpi = Math.min(graphic.effectivePpi[0], graphic.effectivePpi[1]);
        } else {
            // For other graphics, try to calculate from properties
            var frame = graphic.parent;
            
            // Check if we can get dimensions
            if (graphic.itemLink && graphic.itemLink.dimensions) {
                var originalDimensions = graphic.itemLink.dimensions;
                var scaledDimensions = [frame.geometricBounds[3] - frame.geometricBounds[1], 
                                       frame.geometricBounds[2] - frame.geometricBounds[0]];
                
                // Rough calculation based on scale and assumed original PPI of 72
                var scaleX = scaledDimensions[0] / originalDimensions[0];
                var scaleY = scaledDimensions[1] / originalDimensions[1];
                effectivePpi = 72 * Math.min(scaleX, scaleY);
            } else {
                // If we can't determine dimensions, return high value to skip
                return 9999;
            }
        }
        
        return effectivePpi;
    } catch (e) {
        // If there's an error, return a high value to skip this image
        return 9999;
    }
}

function findGraphicPage(doc, graphic) {
    try {
        // Get the parent of the graphic (usually a frame)
        var parentItem = graphic.parent;
        
        // Loop through all pages in the document
        for (var i = 0; i < doc.pages.length; i++) {
            var page = doc.pages[i];
            
            // Check if the parent is on this page
            var pageItems = page.allPageItems;
            for (var j = 0; j < pageItems.length; j++) {
                if (pageItems[j] === parentItem) {
                    return page.name; // Return the page name or number
                }
            }
        }
        
        // If we couldn't find the page, check parent spreads
        for (var s = 0; s < doc.spreads.length; s++) {
            var spread = doc.spreads[s];
            var spreadItems = spread.allPageItems;
            
            for (var k = 0; k < spreadItems.length; k++) {
                if (spreadItems[k] === parentItem) {
                    // Return the first page in the spread as a fallback
                    return spread.pages[0].name;
                }
            }
        }
        
        return "?"; // If we couldn't determine the page
    } catch (e) {
        return "?";
    }
}

function upsampleInPhotoshop(imagesToProcess, targetPpi) {
    if (imagesToProcess.length === 0) return;
    
    var message = "This will upsample " + imagesToProcess.length + 
                  " image" + (imagesToProcess.length !== 1 ? "s" : "") + " to " + targetPpi + 
                  " PPI in Photoshop.\n\nContinue?";
    
    if (!confirm(message)) return;
    
    // Check if BridgeTalk is available
    if (typeof BridgeTalk === "undefined") {
        alert("BridgeTalk is not available. Cannot communicate with Photoshop.");
        return;
    }
    
    // Check if Photoshop is available
    if (!BridgeTalk.isRunning("photoshop")) {
        alert("Photoshop is not running. Please start Photoshop and try again.");
        return;
    }
    
    // Create progress bar
    var progressWin = new Window("palette", "Upsampling Images...");
    progressWin.orientation = "column";
    progressWin.alignChildren = ["fill", "top"];
    progressWin.spacing = 10;
    progressWin.margins = 16;
    
    var progressBar = progressWin.add("progressbar", undefined, 0, imagesToProcess.length);
    progressBar.preferredSize.width = 300;
    
    var progressText = progressWin.add("statictext", undefined, "Processing 0 of " + imagesToProcess.length);
    progressText.alignment = ["center", "top"];
    
    progressWin.show();
    
    // Process each image sequentially using BridgeTalk
    processNextImage(imagesToProcess, 0, targetPpi, progressWin, progressBar, progressText);
}

function processNextImage(images, index, targetPpi, progressWin, progressBar, progressText) {
    if (index >= images.length) {
        // All images processed, ask about updating links
        progressWin.close();
        
        if (confirm("All images have been upsampled. Would you like to update links in InDesign?")) {
            for (var i = 0; i < images.length; i++) {
                try {
                    images[i].link.update();
                } catch (e) {
                    // Continue even if one update fails
                }
            }
            alert("Links updated successfully!");
        } else {
            alert("Upsampling complete! You may need to manually update links in InDesign.");
        }
        
        return;
    }
    
    var currentImage = images[index];
    var linkPath = currentImage.link.filePath;
    var currentPpi = currentImage.effectivePpi;
    
    // Update progress UI
    progressBar.value = index + 1;
    progressText.text = "Processing " + (index + 1) + " of " + images.length + ": " + currentImage.link.name;
    
    // Calculate scale percentage needed
    var scalePercent = (targetPpi / currentPpi) * 100;
    
    // Build Photoshop script
    var psScript = "function resampleImage() { \n" +
        "   try { \n" +
        "       var docRef = app.open(File('" + linkPath.replace(/\\/g, "\\\\") + "')); \n" +
        "       var startRulerUnits = app.preferences.rulerUnits; \n" +
        "       app.preferences.rulerUnits = Units.PIXELS; \n\n" +
        
        "       // Calculate new dimensions \n" +
        "       var width = docRef.width.value; \n" +
        "       var height = docRef.height.value; \n" +
        "       var newWidth = Math.round(width * " + (scalePercent / 100) + "); \n" +
        "       var newHeight = Math.round(height * " + (scalePercent / 100) + "); \n\n" +
        
        "       // Check if Preserve Details 2.0 is available \n" +
        "       var hasPreserveDetails2 = false; \n" +
        "       try { \n" +
        "           hasPreserveDetails2 = ResampleMethod.PRESERVEDETAILSUPSCALE != undefined; \n" +
        "       } catch(e) { } \n\n" +
        
        "       // Resample the image \n" +
        "       if (hasPreserveDetails2) { \n" +
        "           docRef.resizeImage(newWidth, newHeight, " + targetPpi + ", ResampleMethod.PRESERVEDETAILSUPSCALE, 0); \n" +
        "       } else { \n" +
        "           docRef.resizeImage(newWidth, newHeight, " + targetPpi + ", ResampleMethod.BICUBIC); \n" +
        "       } \n\n" +
        
        "       // Save and close \n" +
        "       docRef.save(); \n" +
        "       docRef.close(SaveOptions.SAVECHANGES); \n" +
        "       app.preferences.rulerUnits = startRulerUnits; \n" +
        
        "       return 'Successfully resampled: " + currentImage.link.name + "'; \n" +
        "   } catch(e) { \n" +
        "       if (app.documents.length > 0) { \n" +
        "           app.activeDocument.close(SaveOptions.DONOTSAVECHANGES); \n" +
        "       } \n" +
        "       return 'Error: ' + e; \n" +
        "   } \n" +
        "} \n" +
        "resampleImage();";
    
    // Send to Photoshop via BridgeTalk
    var bt = new BridgeTalk();
    bt.target = "photoshop";
    bt.body = psScript;
    
    bt.onResult = function(result) {
        // Process next image
        processNextImage(images, index + 1, targetPpi, progressWin, progressBar, progressText);
    };
    
    bt.onError = function(err) {
        alert("Error processing " + currentImage.link.name + ": " + err.body);
        // Continue with next image despite error
        processNextImage(images, index + 1, targetPpi, progressWin, progressBar, progressText);
    };
    
    bt.send();
}

// For dockable panel support
if (typeof panel !== "undefined" && panel && panel instanceof Panel) {
    main.call(panel);
} else {
    var panel = main();
}