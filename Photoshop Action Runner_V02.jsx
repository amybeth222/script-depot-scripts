// Photoshop Action Runner_V01
#targetengine "session"
var SCRIPT_NAME="Photoshop Action Runner_V01";
function main() {
    if (app.documents.length === 0) { alert("No document open."); return; }
    var doc = app.activeDocument;

    // ---------- Helpers ----------
    function extLower(nm){ var m=/\.[^\.]+$/.exec(nm||""); return m?m[0].toLowerCase():""; }
    function ensureFile(link){ var fpath=link.filePath||link.filePath; if(!fpath) return null; var f=new File(fpath); return f.exists?f:null; }
    function getColorSpaceOfLink(lnk){
        try{ if(lnk && lnk.parent && lnk.parent.parent && lnk.parent.parent.graphics && lnk.parent.parent.graphics.length>0){
            var gr=lnk.parent.parent.graphics[0]; if(gr && gr.space) return gr.space.toString(); } }catch(e){}
        try{ if(lnk && lnk.linkXmp && lnk.linkXmp.properties && lnk.linkXmp.properties.colorSpace){ return lnk.linkXmp.properties.colorSpace; } }catch(e2){}
        return "";
    }
    function getColorProfileOfLink(lnk){
        try{
            if(lnk && lnk.linkXmp && lnk.linkXmp.properties){
                var p=lnk.linkXmp.properties;
                if(p.iccProfileName) return p.iccProfileName;
                if(p.colorProfile) return p.colorProfile;
                if(p.profileName) return p.profileName;
                if(p.profileDescription) return p.profileDescription;
            }
        }catch(e){}
        return "";
    }

    // ---------- Collect supported links (RGB/CMYK/etc.) ----------
    var allowedExts={".psd":true,".tif":true,".tiff":true,".jpg":true,".jpeg":true};
    var links=doc.links, rgbLinks=[];
    for(var i=0;i<links.length;i++){
        var l=links[i], ext=extLower(l.name); if(!allowedExts[ext]) continue;
        var cs=getColorSpaceOfLink(l);
        var f=ensureFile(l); if(f){
            var pageName=""; try{ var pg=l.parent&&l.parent.parent&&l.parent.parent.parentPage?l.parent.parent.parentPage:null; if(pg) pageName=pg.name; }catch(e){}
            rgbLinks.push({ link:l, file:f, name:l.name, fsName:f.fsName, page:pageName, profile:getColorProfileOfLink(l)||cs||"" });
        }
    }
    if(rgbLinks.length===0){ alert("No PSD/TIFF/JPEG links found in the document."); return; }

    // ---------- UI ----------
    var w=new Window("palette",SCRIPT_NAME,undefined,{closeButton:true});
    w.orientation="column"; w.alignChildren="fill";

    var info=w.add("statictext",undefined,"Found "+rgbLinks.length+" supported image(s) (RGB/CMYK/etc). Use separate steps: Save as PSD + Relink, then Run Action.");
    info.characters=64;

    // Photoshop target chooser
    var psRow=w.add("group"); psRow.orientation="row"; psRow.alignChildren="left";
    psRow.add("statictext",undefined,"Photoshop Target:");
    var ddPsTargets=psRow.add("dropdownlist",[0,0,320,24],[]);
    var btnRefreshPs=psRow.add("button",undefined,"Refresh");
    var psInfo=w.add("statictext",undefined,"");
    psInfo.characters=64;
    var psDetail=w.add("statictext",undefined,"");
    psDetail.characters=64;

    // List of images
    var list=w.add("listbox",[0,0,720,300],[],{multiselect:true,numberOfColumns:3,showHeaders:true,columnTitles:["Name","Page","Color Profile"],columnWidths:[300,90,300]});
    for(var j=0;j<rgbLinks.length;j++){ var it=rgbLinks[j]; var row=list.add("item",it.name); row.subItems[0].text=it.page||""; row.subItems[1].text=it.profile||""; row._dataIndex=j; it._row=row; }

    // Actions area (all sets/actions)
    var actionsPanel=w.add("panel",undefined,"Photoshop Actions"); actionsPanel.orientation="column"; actionsPanel.alignChildren="left";

    var row1=actionsPanel.add("group");
    row1.add("statictext",undefined,"Action Set:");
    var ddSet=row1.add("dropdownlist",[0,0,340,24],[]);
    var btnLoad=row1.add("button",undefined,"Load from Photoshop");

    var row2=actionsPanel.add("group"); row2.add("statictext",undefined,"Action:");
    var ddAction=row2.add("dropdownlist",[0,0,340,24],[]);
    var emptyHint=row2.add("statictext",undefined,"(no actions found)"); emptyHint.visible=false;

    var btnGrp=w.add("group"); btnGrp.alignment="right";
    var relinkPsdBtn=btnGrp.add("button",undefined,"Save as PSD + Relink Only");
    var runSelBtn=btnGrp.add("button",undefined,"Run Action on Selected");
    var runAllBtn=btnGrp.add("button",undefined,"Run Action on All");
    var refreshProfilesBtn=btnGrp.add("button",undefined,"Refresh Profiles");
    var gotoBtn=btnGrp.add("button",undefined,"Go to Page Item");
    var closeBtn=btnGrp.add("button",undefined,"Close");

    var status=w.add("statictext",undefined,""); status.characters=64;
    var progressBar=w.add("progressbar",undefined,0,100); progressBar.value=0; progressBar.visible=false;

    // ---------- Session memory ----------
    if(!$.global.__RGB_BIN_PREFS__) $.global.__RGB_BIN_PREFS__={ psTarget:"", setName:"", actName:"" };
    var prefs=$.global.__RGB_BIN_PREFS__;
    var preferredActionName="Convert RGB to CMYK Gracol 2006";
    var actionsBySet={};

    // ---------- Photoshop target discovery ----------
    function populatePhotoshopTargets(){
        ddPsTargets.removeAll();
        var targets=BridgeTalk.getTargets(), psTargets=[];
        for(var i=0;i<targets.length;i++){ var t=targets[i]; if(t==="photoshop" || (t.indexOf("photoshop-")===0)) psTargets.push(t); }
        var unique=[]; for(var u=0;u<psTargets.length;u++){ var exists=false; for(var v=0;v<unique.length;v++){ if(unique[v]===psTargets[u]){exists=true;break;} } if(!exists) unique.push(psTargets[u]); }
        unique.sort(function(a,b){ if(a==="photoshop") return -1; if(b==="photoshop") return 1; return a<b?-1:(a>b?1:0); });
        for(var k=0;k<unique.length;k++) ddPsTargets.add("item",unique[k]);
        if(ddPsTargets.items.length>0){
            var selIndex=-1;
            if(prefs.psTarget){
                for(var i2=0;i2<ddPsTargets.items.length;i2++){ if(ddPsTargets.items[i2].text===prefs.psTarget){ selIndex=i2; break; } }
            }
            if(selIndex<0){
                for(var b1=0;b1<ddPsTargets.items.length;b1++){
                    var t1=ddPsTargets.items[b1].text.toLowerCase();
                    if(t1.indexOf("beta")>=0 && t1.indexOf("2026")>=0){ selIndex=b1; break; }
                }
            }
            if(selIndex<0){
                for(var b2=0;b2<ddPsTargets.items.length;b2++){
                    var t2=ddPsTargets.items[b2].text.toLowerCase();
                    if(t2.indexOf("beta")>=0){ selIndex=b2; break; }
                }
            }
            if(selIndex<0){
                for(var b3=0;b3<ddPsTargets.items.length;b3++){
                    if(ddPsTargets.items[b3].text==="photoshop-2026"){ selIndex=b3; break; }
                }
            }
            if(selIndex<0){
                for(var b4=0;b4<ddPsTargets.items.length;b4++){
                    if(ddPsTargets.items[b4].text==="photoshop-beta"){ selIndex=b4; break; }
                }
            }
            if(selIndex<0) selIndex=0;
            ddPsTargets.selection=selIndex;
            prefs.psTarget=ddPsTargets.selection.text;
        }
    }
    populatePhotoshopTargets();
    btnRefreshPs.onClick=function(){ populatePhotoshopTargets(); updatePsCallout(); updatePsDetail(); loadActionsFromPS(); };
    function getChosenPsTarget(){ return ddPsTargets.selection?ddPsTargets.selection.text:"photoshop"; }
    function updatePsCallout(){
        var tgt=getChosenPsTarget();
        if(/beta/i.test(tgt)) psInfo.text="Using Photoshop Beta target: "+tgt;
        else if(tgt==="photoshop") psInfo.text="Using Photoshop target: photoshop (default)";
        else psInfo.text="Using Photoshop target: "+tgt;
    }
    function updatePsDetail(){
        var tgt=getChosenPsTarget();
        psDetail.text="Resolving target details for "+tgt+"...";
        var psCode=[
            "(function(){",
            "try{",
            " var nm=''; var ver=''; var p='';",
            " try{ nm=app.name||''; }catch(e1){}",
            " try{ ver=app.version||''; }catch(e2){}",
            " try{ p=app.path?app.path.fsName:''; }catch(e3){}",
            " return (nm||'Photoshop')+'##'+(ver||'unknown')+'##'+(p||'');",
            "}catch(e){ return 'ERR:'+e; }",
            "})()"
        ].join("\n");
        try{
            var bt=new BridgeTalk(); bt.target=tgt; bt.body=psCode;
            bt.onResult=function(res){
                var body=res&&res.body?res.body:"";
                if(!body || body.indexOf("ERR:")===0){
                    psDetail.text="Target details unavailable for "+tgt;
                    return;
                }
                var parts=body.split("##");
                var name=parts.length>0?parts[0]:"Photoshop";
                var ver=parts.length>1?parts[1]:"unknown";
                psDetail.text="Connected target: "+name+" v"+ver+" ("+tgt+")";
            };
            bt.onError=function(){ psDetail.text="Target details unavailable for "+tgt; };
            bt.send();
        }catch(e){ psDetail.text="Target details unavailable for "+tgt; }
    }
    ddPsTargets.onChange=function(){
        $.global.__RGB_BIN_PREFS__.psTarget=getChosenPsTarget();
        updatePsCallout();
        updatePsDetail();
        loadActionsFromPS();
    };
    updatePsCallout();
    updatePsDetail();

    // ---------- Load actions from Photoshop ----------
    function setActionUIDisabled(disabled, showHint){
        ddSet.enabled=!disabled;
        ddAction.enabled=!disabled;
        emptyHint.visible=!!showHint;
    }

    function populateActionsForSet(setName){
        ddAction.removeAll();
        var arr=actionsBySet[setName]||[];
        for(var i=0;i<arr.length;i++) ddAction.add("item", arr[i]);

        if(ddAction.items.length===0){
            setActionUIDisabled(true,true);
            return;
        }

        setActionUIDisabled(false,false);
        var restored=false;
        if(prefs.actName){
            for(var r=0;r<ddAction.items.length;r++){
                if(ddAction.items[r].text===prefs.actName){ ddAction.selection=r; restored=true; break; }
            }
        }
        if(!restored){
            for(var p=0;p<ddAction.items.length;p++){
                if(ddAction.items[p].text===preferredActionName){ ddAction.selection=p; restored=true; break; }
            }
        }
        if(!restored) ddAction.selection=0;
    }

    function loadActionsFromPS(){
        var tgt=getChosenPsTarget();
        status.text="Loading actions from "+tgt+"...";
        var psCode=[
            "(function(){",
            "function c2t(s){return app.charIDToTypeID(s);} function getStr(d,k){try{return d.getString(k);}catch(e){return '';} } function getInt(d,k){try{return d.getInteger(k);}catch(e){return 0;} }",
            "function listSets(){ var out=[]; var i=1; while(true){",
            "  try{ var rS=new ActionReference(); rS.putIndex(c2t('ASet'), i); var dS=executeActionGet(rS); var setName=getStr(dS, c2t('Nm  ')); if(!setName) setName='Set '+i; var aCount=getInt(dS, c2t('NmbC'));",
            "   var acts=[]; for(var j=1;j<=aCount;j++){ var rA=new ActionReference(); rA.putIndex(c2t('Actn'), j); rA.putIndex(c2t('ASet'), i); var dA=executeActionGet(rA); var actionName=getStr(dA, c2t('Nm  ')); if(!actionName) actionName='Action '+j; acts.push(actionName); }",
            "   out.push({name:setName,actions:acts}); i++; }catch(e){ break; } } return out; }",
            "try{ app.displayDialogs=DialogModes.NO; var sets=listSets(); if(!sets || sets.length===0) return 'ERR:No sets'; return ({found:true,sets:sets}).toSource(); } catch(e){ return 'ERROR:'+e; }",
            "})()"
        ].join("\n");

        try{
            var bt=new BridgeTalk(); bt.target=tgt; bt.body=psCode;
            bt.onResult=function(res){
                var body=res.body||""; if(!body){ status.text="No response from "+tgt+"."; return; }
                if(body.indexOf("ERROR:")===0 || body.indexOf("ERR:")===0){ status.text="Could not load actions from "+tgt+"."; setActionUIDisabled(true,true); return; }
                try{
                    var data=eval(body); // {found:true,sets:[{name:String,actions:Array}]}
                    ddSet.removeAll();
                    ddAction.removeAll();
                    actionsBySet={};
                    if(data && data.found && data.sets && data.sets.length>0){
                        for(var i=0;i<data.sets.length;i++){
                            var setObj=data.sets[i];
                            actionsBySet[setObj.name]=setObj.actions||[];
                            ddSet.add("item", setObj.name);
                        }

                        var setRestored=false;
                        if(prefs.setName){
                            for(var s=0;s<ddSet.items.length;s++){
                                if(ddSet.items[s].text===prefs.setName){ ddSet.selection=s; setRestored=true; break; }
                            }
                        }
                        if(!setRestored) ddSet.selection=0;
                        populateActionsForSet(ddSet.selection.text);
                        status.text="Loaded "+ddSet.items.length+" action set(s) from "+tgt+".";
                    } else {
                        setActionUIDisabled(true,true);
                        status.text="No actions available from "+tgt+".";
                    }
                }catch(e){ status.text="Failed to parse data from "+tgt+"."; }
            };
            bt.onError=function(err){ alert("BridgeTalk error from "+tgt+": "+(err&&err.body?err.body:err)); status.text="Could not load actions."; };
            bt.send();
        }catch(e){ alert("BridgeTalk send failed: "+e); status.text="Could not send request."; }
    }

    ddSet.onChange=function(){
        if(!ddSet.selection) return;
        prefs.setName=ddSet.selection.text;
        populateActionsForSet(ddSet.selection.text);
    };
    ddAction.onChange=function(){
        if(ddAction.selection) prefs.actName=ddAction.selection.text;
    };

    btnLoad.onClick=loadActionsFromPS;
    loadActionsFromPS();

    function getChosenActionAndSet(){
        if(!ddSet.selection){
            alert("Please load Photoshop actions and choose an Action Set.");
            throw new Error("No action set chosen.");
        }
        if(!ddAction.selection){
            alert("Please click 'Load from Photoshop' and choose an Action.");
            throw new Error("No action chosen.");
        }
        var actName=ddAction.selection.text;
        var setName=ddSet.selection.text;
        $.global.__RGB_BIN_PREFS__.setName=setName;
        $.global.__RGB_BIN_PREFS__.actName=actName;
        $.global.__RGB_BIN_PREFS__.psTarget=getChosenPsTarget();
        return {action:actName,set:setName};
    }

    function getSelectedItems(){
        var sels=list.selection;
        if(!sels||sels.length===0) return normalizeSelectedItems(getSelectedItemsFromDocumentSelection());
        var items=[];
        if(sels.length===undefined) items.push(rgbLinks[sels._dataIndex]);
        else for(var i=0;i<sels.length;i++) items.push(rgbLinks[sels[i]._dataIndex]);
        return normalizeSelectedItems(items);
    }

    function normalizeSelectedItems(items){
        var out=[];
        if(!items||items.length===0) return out;
        for(var i=0;i<items.length;i++) pushUniqueRecord(out, items[i]);
        return out;
    }

    function findRecordByLink(linkObj){
        if(!linkObj) return null;
        for(var i=0;i<rgbLinks.length;i++){
            var rec=rgbLinks[i];
            try{
                if(rec.link===linkObj) return rec;
            }catch(e1){}
            try{
                if(rec.link && linkObj && rec.link.id===linkObj.id) return rec;
            }catch(e2){}
            try{
                if(rec.link && linkObj && rec.link.name===linkObj.name && rec.link.filePath===linkObj.filePath) return rec;
            }catch(e3){}
        }
        return null;
    }

    function pushUniqueRecord(arr, rec){
        if(!rec) return;
        for(var i=0;i<arr.length;i++) if(arr[i]===rec) return;
        arr.push(rec);
    }

    function getSelectedItemsFromDocumentSelection(){
        var out=[];
        var sel=[];
        try{ sel=app.selection||[]; }catch(e){ sel=[]; }
        if(!sel || sel.length===0) return out;

        for(var i=0;i<sel.length;i++){
            var s=sel[i];
            try{
                if(s.constructor && s.constructor.name==="Link"){
                    pushUniqueRecord(out, findRecordByLink(s));
                    continue;
                }
            }catch(e1){}

            try{
                if(s.itemLink){
                    pushUniqueRecord(out, findRecordByLink(s.itemLink));
                    continue;
                }
            }catch(e2){}

            try{
                if(s.graphics && s.graphics.length>0){
                    for(var g=0; g<s.graphics.length; g++){
                        var il=s.graphics[g].itemLink;
                        if(il) pushUniqueRecord(out, findRecordByLink(il));
                    }
                }
            }catch(e3){}

            try{
                if(s.allGraphics && s.allGraphics.length>0){
                    for(var ag=0; ag<s.allGraphics.length; ag++){
                        var il2=s.allGraphics[ag].itemLink;
                        if(il2) pushUniqueRecord(out, findRecordByLink(il2));
                    }
                }
            }catch(e4){}
        }

        return out;
    }

    function updateRowDisplay(rec){
        if(rec && rec._row){
            rec._row.text=rec.name||"";
            rec._row.subItems[0].text=rec.page||"";
            rec._row.subItems[1].text=rec.profile||"";
        }
    }

    function updateLinksForItems(items){
        if(!items||items.length===0) return {ok:0,fail:0};
        var ok=0, fail=0;
        for(var i=0;i<items.length;i++){
            var rec=items[i];
            try{
                rec.link.update();
                rec.profile=getColorProfileOfLink(rec.link)||getColorSpaceOfLink(rec.link)||rec.profile||"";
                updateRowDisplay(rec);
                ok++;
            }catch(e){ fail++; }
        }
        return {ok:ok,fail:fail};
    }

    function getCurrentFileForRecord(rec){
        try{
            if(rec && rec.link && rec.link.filePath){
                var linked=new File(rec.link.filePath);
                if(linked.exists) return linked;
            }
        }catch(e){}
        return rec && rec.file ? rec.file : null;
    }

    function getExactLinkedFile(rec){
        try{
            if(rec && rec.link && rec.link.filePath){
                var f=new File(rec.link.filePath);
                if(f.exists) return f;
            }
        }catch(e){}
        return getCurrentFileForRecord(rec);
    }

    function fetchProfileFromPS(fileObj, onDone, onErr){
        var tgt=getChosenPsTarget();
        var psCode=[
            "(function(){ try{",
            "app.displayDialogs=DialogModes.NO; var f=File("+uneval(fileObj.fullName)+"); if(!f.exists) return 'ERR:Missing file';",
            "var d=app.open(f); if(!d) return 'ERR:Open failed';",
            "var mode=''; try{ mode=String(d.mode||''); mode=mode.replace('DocumentMode.',''); }catch(me){}",
            "var prof='';",
            "try{ var sid=app.stringIDToTypeID; var ref=new ActionReference(); ref.putProperty(sid('property'), sid('profile')); ref.putEnumerated(sid('document'), sid('ordinal'), sid('targetEnum')); var desc=executeActionGet(ref); if(desc && desc.hasKey(sid('profile'))) prof=desc.getString(sid('profile')); }catch(pa){}",
            "if(!prof){ try{ prof=d.colorProfileName||''; }catch(pe){} }",
            "var icc=''; try{ if(d.info && d.info.ICCProfile) icc=d.info.ICCProfile; }catch(ie){}",
            "try{ d.close(SaveOptions.DONOTSAVECHANGES); }catch(ce){}",
            "return (prof||'')+'##'+(icc||'')+'##'+(mode||'');",
            "}catch(e){ return 'ERR:'+e; } })()"
        ].join("\n");

        try{
            var bt=new BridgeTalk(); bt.target=tgt; bt.body=psCode;
            bt.onResult=function(res){
                var body=res&&res.body?res.body:"";
                if(body.indexOf("ERR:")===0){ if(onErr) onErr(body); return; }
                if(onDone) onDone(body);
            };
            bt.onError=function(err){ if(onErr) onErr(err&&err.body?err.body:err); };
            bt.send();
        }catch(e){ if(onErr) onErr(e); }
    }

    function refreshProfilesForItems(items, showDoneAlert){
        if(!items||items.length===0){ if(showDoneAlert) alert("No items selected."); return; }
        var idx=0, ok=0, fail=0;
        progressBar.visible=true;
        progressBar.value=0;

        function nextProfile(){
            if(idx>=items.length){
                status.text="Profiles refreshed. Success: "+ok+", Failed: "+fail+".";
                if(showDoneAlert) alert("Profile refresh finished. Success: "+ok+", Failed: "+fail+".");
                progressBar.value=0;
                progressBar.visible=false;
                return;
            }
            var rec=items[idx++];
            status.text="["+idx+"/"+items.length+"] Reading profile for "+rec.name+"...";
            var currentFile=getCurrentFileForRecord(rec);
            if(!currentFile){
                rec.profile=getColorProfileOfLink(rec.link)||getColorSpaceOfLink(rec.link)||rec.profile||"";
                updateRowDisplay(rec);
                fail++;
                progressBar.value=Math.round((ok+fail)*100/items.length);
                nextProfile();
                return;
            }
            fetchProfileFromPS(currentFile, function(payload){
                var prof="", mode="", icc="";
                try{
                    var parts=payload.split("##");
                    prof=parts.length>0?parts[0]:"";
                    icc=parts.length>1?parts[1]:"";
                    mode=parts.length>2?parts[2]:"";
                }catch(e){}
                rec.profile=prof||icc||mode||getColorProfileOfLink(rec.link)||getColorSpaceOfLink(rec.link)||"Unknown";
                updateRowDisplay(rec);
                ok++;
                progressBar.value=Math.round((ok+fail)*100/items.length);
                nextProfile();
            }, function(){
                rec.profile=getColorProfileOfLink(rec.link)||getColorSpaceOfLink(rec.link)||rec.profile||"Unknown";
                updateRowDisplay(rec);
                fail++;
                progressBar.value=Math.round((ok+fail)*100/items.length);
                nextProfile();
            });
        }
        nextProfile();
    }

    function psdPathFromFileName(name){
        if(/\.[^\.]+$/.test(name)) return name.replace(/\.[^\.]+$/, ".psd");
        return name+".psd";
    }

    function getSourceAndPsdDest(rec){
        var srcPath="";
        try{ srcPath=rec && rec.link && rec.link.filePath ? rec.link.filePath : ""; }catch(e){}
        if(!srcPath && rec && rec.file) srcPath=rec.file.fsName;
        var srcFile=new File(srcPath);
        var psdName=psdPathFromFileName(srcFile.name);
        var dstFile=new File(srcFile.path+"/"+psdName);
        return {src:srcFile,dst:dstFile,psdName:psdName};
    }

    function relinkGracefully(rec, targetFile){
        try{
            rec.link.relink(targetFile);
            rec.link.update();
            return true;
        }catch(e){
            // If already linked to the exact same file, treat as success.
            try{
                var fp=rec && rec.link ? rec.link.filePath : "";
                if(fp){
                    var cur=new File(fp);
                    if(cur.exists && targetFile.exists){
                        var curPath=cur.fsName;
                        var tgtPath=targetFile.fsName;
                        if(curPath===tgtPath) return true;
                    }
                }
            }catch(e2){}
            return false;
        }
    }

    function computeFinalRelinkSummary(items){
        var ok=0, fail=0, failedNames=[];
        for(var i=0;i<items.length;i++){
            var rec=items[i];
            var isGood=false;
            try{
                try{ rec.link.update(); }catch(uErr){}

                var fp=rec && rec.link ? rec.link.filePath : "";
                if(fp){
                    var lf=new File(fp);
                    if(lf.exists && extLower(lf.name)===".psd"){
                        rec.file=lf;
                        rec.fsName=lf.fsName;
                        rec.name=lf.name;
                        rec.profile=getColorProfileOfLink(rec.link)||getColorSpaceOfLink(rec.link)||rec.profile||"";
                        updateRowDisplay(rec);
                        isGood=true;
                    }
                }

                // Fallback: record was updated even if link.filePath is slow to reflect.
                if(!isGood && rec && rec.file){
                    var rf=rec.file;
                    if(rf.exists && extLower(rf.name)===".psd"){
                        isGood=true;
                    }
                }
            }catch(e){}
            if(isGood) ok++; else { fail++; failedNames.push(rec && rec.name ? rec.name : ("Item "+(i+1))); }
        }
        return {ok:ok, fail:fail, failedNames:failedNames};
    }

    function relinkItemsToPsd(items){
        if(!items||items.length===0){ alert("No items selected."); return; }
        var tgt=getChosenPsTarget();
        progressBar.visible=true;
        progressBar.value=0;
        status.text="Creating PSD and relinking "+items.length+" file(s) via "+tgt+"...";
        var idx=0, ok=0, fail=0;

        function nextRelink(){
            if(idx>=items.length){
                var finalSummary=computeFinalRelinkSummary(items);
                ok=finalSummary.ok;
                fail=finalSummary.fail;
                status.text="PSD relink complete. Success: "+ok+", Failed: "+fail+".";
                updateLinksForItems(items);
                refreshProfilesForItems(items, false);
                if(fail===0) alert("PSD relink has successfully finished. Success: "+ok+", Failed: 0.");
                else if(ok>0) alert("PSD relink finished with warnings. Success: "+ok+", Failed: "+fail+".\nFailed: "+finalSummary.failedNames.join(", "));
                else alert("PSD relink failed. Success: 0, Failed: "+fail+".");
                progressBar.value=0;
                progressBar.visible=false;
                return;
            }

            var rec=items[idx++];
            var io=getSourceAndPsdDest(rec);
            var src=io.src;
            var dst=io.dst;
            status.text="["+(idx)+"/"+items.length+"] Converting "+src.name+" to PSD...";
            var srcExt=extLower(src.name);

            // If the source is already PSD, just relink/update and continue.
            if(srcExt===".psd"){
                try{
                    if(relinkGracefully(rec, src)){
                        rec.file=src;
                        rec.fsName=src.fsName;
                        rec.name=src.name;
                        rec.profile=getColorProfileOfLink(rec.link)||getColorSpaceOfLink(rec.link)||rec.profile||"";
                        updateRowDisplay(rec);
                        ok++;
                    } else {
                        fail++;
                        status.text="Relink failed for existing PSD: "+src.name;
                        alert("Relink failed for "+src.name);
                    }
                }catch(e0){
                    fail++;
                    status.text="Relink failed for existing PSD: "+src.name+" ("+e0+")";
                    alert("Relink failed for "+src.name+"\n"+e0);
                }
                progressBar.value=Math.round((ok+fail)*100/items.length);
                nextRelink();
                return;
            }

            var psCode=[
                "(function(){ try{",
                "app.displayDialogs=DialogModes.NO; var src=File("+uneval(src.fullName)+"); var dst=File("+uneval(dst.fullName)+");",
                "if(!src.exists) return 'ERR:File not found: '+src.fsName;",
                "var d=app.open(src); if(!d) return 'ERR:Open failed for '+src.fsName;",
                "var ps=new PhotoshopSaveOptions(); ps.embedColorProfile=true; ps.layers=true; ps.alphaChannels=true;",
                "try{ d.saveAs(dst, ps, true, Extension.LOWERCASE); }catch(se){ try{ if(d&&d.isValid) d.close(SaveOptions.DONOTSAVECHANGES); }catch(e1){} return 'ERR:SaveAs failed: '+se; }",
                "try{ if(d&&d.isValid) d.close(SaveOptions.DONOTSAVECHANGES); }catch(e2){}",
                "return 'OK:'+dst.fsName;",
                "}catch(e){ return 'ERR:'+e; } })()"
            ].join("\n");

            try{
                var bt=new BridgeTalk(); bt.target=tgt; bt.body=psCode;
                bt.onResult=function(res){
                    try{
                        var body=res&&res.body?res.body:"";
                        var relinked=false;

                        function relinkAndMark(psdFile){
                            if(!relinkGracefully(rec, psdFile)) throw new Error("Relink could not be confirmed.");
                            rec.file=psdFile;
                            rec.fsName=psdFile.fsName;
                            rec.name=psdFile.name;
                            rec.profile=getColorProfileOfLink(rec.link)||getColorSpaceOfLink(rec.link)||rec.profile||"";
                            updateRowDisplay(rec);
                            ok++;
                            relinked=true;
                        }

                        if(body.indexOf("ERR:")===0){
                            // Some Photoshop builds can return an error string even if the file was still written.
                            if(dst.exists){
                                try{
                                    relinkAndMark(dst);
                                    status.text="Converted with warning for "+src.name+": "+body.substring(4);
                                }catch(eWarn){
                                    fail++;
                                    status.text="PSD conversion warning + relink failed for "+src.name+": "+eWarn;
                                    alert("PSD conversion warning and relink failed for "+src.name+"\n"+body+"\n"+eWarn);
                                }
                            } else {
                                fail++;
                                status.text="PSD conversion failed for "+src.name+": "+body.substring(4);
                                alert("PSD conversion failed for "+src.name+"\n"+body);
                            }
                            progressBar.value=Math.round((ok+fail)*100/items.length);
                            nextRelink();
                            return;
                        }
                        var outPath=body.indexOf("OK:")===0?body.substring(3):"";
                        if(outPath && outPath.replace) outPath=outPath.replace(/^\s+|\s+$/g, "");
                        var psdFile=outPath?new File(outPath):dst;
                        if(psdFile.exists){
                            relinkAndMark(psdFile);
                        } else {
                            fail++;
                            status.text="PSD not found after save: "+dst.fsName;
                            alert("PSD was not created for "+src.name+"\nExpected: "+dst.fsName);
                        }
                    }catch(e){ fail++; status.text="Error relinking: "+e; }
                    progressBar.value=Math.round((ok+fail)*100/items.length);
                    nextRelink();
                };
                bt.onError=function(err){
                    // Some BridgeTalk errors still produce the destination file.
                    if(dst.exists){
                        try{
                            if(relinkGracefully(rec, dst)){
                                rec.file=dst;
                                rec.fsName=dst.fsName;
                                rec.name=dst.name;
                                rec.profile=getColorProfileOfLink(rec.link)||getColorSpaceOfLink(rec.link)||rec.profile||"";
                                updateRowDisplay(rec);
                                ok++;
                                status.text="BridgeTalk warning but PSD created for "+src.name;
                            } else {
                                fail++;
                                status.text="BridgeTalk warning and relink could not be confirmed for "+src.name;
                            }
                        }catch(eBt){
                            fail++;
                            status.text="BridgeTalk error + relink failed: "+(err&&err.body?err.body:err);
                            alert("Error on "+src.name+": "+(err&&err.body?err.body:err)+"\n"+eBt);
                        }
                    } else {
                        fail++;
                        status.text="BridgeTalk error: "+(err&&err.body?err.body:err);
                        alert("Error on "+src.name+": "+(err&&err.body?err.body:err));
                    }
                    progressBar.value=Math.round((ok+fail)*100/items.length);
                    nextRelink();
                };
                bt.send();
            }catch(e){ fail++; status.text="Exception on "+src.name+": "+e; alert("Error: "+e); nextRelink(); }
        }

        nextRelink();
    }

    // ---------- Processing (run chosen action only) ----------
    function processItems(items){
        if(!items||items.length===0){ alert("No items selected."); return; }
        items=normalizeSelectedItems(items);
        var choice=getChosenActionAndSet(), actionName=choice.action, actionSet=choice.set, tgt=getChosenPsTarget();
        progressBar.visible=true;
        progressBar.value=0;
        status.text="Running action on "+items.length+" file(s)...";
        var idx=0, ok=0, fail=0;

        function nextStep(){
            if(idx>=items.length){
                status.text="Done. Success: "+ok+", Failed: "+fail+". Updating links...";
                updateLinksForItems(items);
                refreshProfilesForItems(items, false);
                status.text="Completed. Success: "+ok+", Failed: "+fail+".";
                alert("Action has successfully finished. Success: "+ok+", Failed: "+fail+".");
                progressBar.value=0;
                progressBar.visible=false;
                return;
            }
            var rec=items[idx++];
            try{ rec.link.update(); }catch(_u){}
            var currentFile=getExactLinkedFile(rec);
            if(!currentFile || !currentFile.exists){
                fail++;
                status.text="File missing for "+(rec.name||("Item "+idx));
                progressBar.value=Math.round((ok+fail)*100/items.length);
                nextStep();
                return;
            }

            // Keep the record synchronized to the exact linked file being processed.
            rec.file=currentFile;
            rec.fsName=currentFile.fsName;
            rec.name=currentFile.name;
            updateRowDisplay(rec);

            status.text="["+idx+"/"+items.length+"] Running action on "+currentFile.name+"...";
            var shouldRetryRgbAction=(/rgb/i.test(actionName) && /(cmyk|gracol|convert)/i.test(actionName));
            var psCodeAction=[
                "(function(){ try{",
                "app.displayDialogs=DialogModes.NO; var f=File("+uneval(currentFile.fullName)+"); if(!f.exists) return 'ERR:File not found';",
                "var doc=app.open(f); if(!doc) return 'ERR:Could not open file';",
                "try{ app.doAction("+uneval(actionName)+", "+uneval(actionSet)+"); } catch(ae){",
                "  var retried=false;",
                "  if("+String(shouldRetryRgbAction)+"){",
                "    try{",
                "      if(doc.bitsPerChannel && doc.bitsPerChannel!=BitsPerChannelType.EIGHT) doc.bitsPerChannel=BitsPerChannelType.EIGHT;",
                "      if(doc.mode && doc.mode!=DocumentMode.RGB) doc.changeMode(ChangeMode.RGB);",
                "      app.doAction("+uneval(actionName)+", "+uneval(actionSet)+");",
                "      retried=true;",
                "    }catch(ae2){}",
                "  }",
                "  if(!retried){ if(doc && doc.isValid) doc.close(SaveOptions.DONOTSAVECHANGES); return 'ERR:Action failed: '+ae; }",
                "}",
                "if(!doc || !doc.isValid) return 'OK:Document already closed by action';",
                "var nm=f.name; var ext=(nm.match(/\\.[^\\.]+$/)||[''])[0].toLowerCase();",
                "try{",
                " if(ext==='.psd'){ var ps=new PhotoshopSaveOptions(); ps.embedColorProfile=true; doc.saveAs(f, ps, true, Extension.LOWERCASE); }",
                " else if(ext==='.tif'||ext==='.tiff'){ var to=new TiffSaveOptions(); to.imageCompression=TIFFEncoding.TIFFLZW; to.embedColorProfile=true; doc.saveAs(f, to, true, Extension.LOWERCASE); }",
                " else if(ext==='.jpg'||ext==='.jpeg'){ var jo=new JPEGSaveOptions(); jo.quality=12; jo.embedColorProfile=true; doc.saveAs(f, jo, true, Extension.LOWERCASE); }",
                " else { doc.save(); }",
                "} catch(se){",
                " try{ if(doc && doc.isValid) doc.save(); }catch(se2){ if(doc && doc.isValid) doc.close(SaveOptions.DONOTSAVECHANGES); return 'ERR:Save failed: '+se; }",
                "}",
                "if(doc && doc.isValid) doc.close(SaveOptions.DONOTSAVECHANGES); return 'OK'; } catch(e){ return 'ERR:'+e; } })()"
            ].join("\n");

            try{
                var bt=new BridgeTalk(); bt.target=tgt; bt.body=psCodeAction;
                bt.onResult=function(res){
                    var body=res&&res.body?res.body:"";
                    if(body.indexOf("ERR:")===0){
                        fail++;
                        status.text="Error running action on "+currentFile.name+": "+body.substring(4);
                        alert("Failed to run action on "+currentFile.name+"\n"+body);
                    } else {
                        ok++;
                        status.text="Successfully processed "+currentFile.name;
                    }
                    progressBar.value=Math.round((ok+fail)*100/items.length);
                    nextStep();
                };
                bt.onError=function(err){ fail++; status.text="BridgeTalk error on action"; alert("Error running action on "+currentFile.name+"\n"+(err&&err.body?err.body:err)); progressBar.value=Math.round((ok+fail)*100/items.length); nextStep(); };
                bt.send();
            }catch(e){ fail++; status.text="Exception"; alert("Exception: "+e); progressBar.value=Math.round((ok+fail)*100/items.length); nextStep(); }
        }

        nextStep();
    }

    runAllBtn.onClick=function(){ progressBar.value=0; processItems(rgbLinks); };
    runSelBtn.onClick=function(){
        var items=getSelectedItems(); if(items.length===0){ alert("Please select one or more items in the list, or select linked frames on the page."); return; }
        progressBar.value=0;
        status.text="Running selected action on "+items.length+" selected image(s)...";
        processItems(items);
    };
    relinkPsdBtn.onClick=function(){
        var items=getSelectedItems();
        if(items.length===0){ alert("Please select one or more items in the list, or select linked frames on the page."); return; }
        relinkItemsToPsd(items);
    };
    refreshProfilesBtn.onClick=function(){
        var items=getSelectedItems(); if(items.length===0) items=rgbLinks;
        refreshProfilesForItems(items, true);
    };
    gotoBtn.onClick=function(){ var sels=list.selection; if(!sels||sels.length===0){ alert("Please select an item to locate on the page."); return; } var row=sels.length&&sels.length!==undefined?sels[0]:sels; var rec=rgbLinks[row._dataIndex]; try{ var parentItem=rec.link.parent&&rec.link.parent.parent?rec.link.parent.parent:null; if(parentItem&&parentItem.isValid){ app.select(parentItem); if(parentItem.parentPage) app.activeWindow.activePage=parentItem.parentPage; } else { alert("Could not locate the page item."); } }catch(e){ alert("Could not select the page item."); } };
    closeBtn.onClick=function(){ try{ w.close(); }catch(e){} };

    // Keep startup lightweight. Profile loading is manual via Refresh Profiles.
    updateLinksForItems(rgbLinks);
    status.text="Ready. Click Refresh Profiles to read profiles from Photoshop.";

    w.center(); w.show();
}
app.doScript(main, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, SCRIPT_NAME);