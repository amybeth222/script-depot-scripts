//@targetengine "session"

// Font Usage Report (Alert on Google Fonts when creating report)

/*     
  
    + Author: Amybeth Menendez

    + Created: September 2025
    + InDesign Version: 2024
    + Script version beta-2.2.2 / Release 1.0

    # key resources:

    + v 2.0 modifications
        - Initial commit from Amybeth
    + v 2.1 modifications
        // add checking for fonts used in tables
        // added mechanism to get updated google font list, details:
            // 1. checks for local _deployed_ googleFontList cache file: if present, uses that (so we can override everything below if needed). if not:
            // 2. checks for local googleFontList cache file modified within 24 hrs, if present, uses that. if not:
            // 3. downloads updated google font list from https://fonts.google.com/metadata/fonts, if successful, writes a new cachefile for next time, and uses that. if not:
            // 4. checks for  googlefontlist cachefile, and uses that. In this case the user gets an alert notification prior to proceeding (see below). if no older cachefile available:
            // 5. uses hardcoded google font list in script.  In this case the user gets an alert notification prior to proceeding:
            //  *user notice: 
            //   "Font Usage Report was unable to check google's font list for updates.\nProceeding with cached google font list from " + cachedate;
        // remove Status column from UI
        // updates to font metadata determination:
            // repaired missing font check (it was not detecting missing fonts)
            // removed system font check where it looked for "system" in the font name
            // google font check: "Zalando Sans Condensed" wasn't gegttign picked up, so added check for partial matches at start of font name, eg. matching against "Zalando Sans "
            // added UTC font check and column to csv
            // added font type check and column to csv: https://www.indesignjs.de/extendscriptAPI/indesign-latest/index.html#FontTypes.html
            // note Postscript fontname is not accurately reporting postscript name, just subbing in FontName - replace with Font Name (on backend and UI)
        // added handling for crash when writing report for unsaved doc
        // Cleaned up local/system / packaged / source cross-labelings
        // added progress bar while scanning fonts (good for larger files)    
    + v 2.2.1 modifications   
        // stopped traversing all font uses and just cycle through Document.fonts:
            This is much much faster for long docs (a concern reported by Maggie), more accurate at reporting font locations and missing fonts.T
            Since 'style' reporting is less accurate for doc.fontObject, using psName and deriving font 'style' from font.name; this appears to be as accurate or more than getting 'style' attribute from applied font objects.
            Additionally some rare missing document fonts do not appear when traversing the document, or when running a find in the backend (v 2.2); so this way the list matches the one in Indesign.
        // fixed bug reported by Amybeth where Document fonts show as Missing.
        // when clicking on 'Scan Document' button, in scans the active document
    + v 2.2.2 beta / RELEASE 1.0
        // added gFontCacheAgeWarningThreshold to delay pop-up and interactiveDev var for testing, 
        // updated version var to RELEASE version    
    + dev to-do's: 
        // create & check-in generic test doc with all font-types as integration test, with csv output diff.        
        // auto-m0nitor google fonts url we are scraping (local cronjob?). or use google apis to post somewhere internal?

*/

app.doScript(main, ScriptLanguage.JAVASCRIPT , [], UndoModes.ENTIRE_SCRIPT, "Macmillan Font Usage Report");

function main() {
    var version = "1.3.0";
    // \/ set this to _true_ to work with VSCode / Indesign testing
    var interactiveDev = false;
    // global vars for google font checking
    var gfontStringHardCodedDate = "Oct 03 2025";
    var gFontCacheAgeThreshold = 1;
    var gFontCacheAgeWarningThreshold = 8;
    var gfonts_url = "https://fonts.google.com/metadata/fonts";
    var gfonts_cacheFilepath = '~/.gfontListCache';
    var gfonts_deployedFilePath = '~/.gfontListCache_deployed';    
    var gfcListHardCoded = ["abeezee","adlam display","ar one sans","abel","abhaya libre","aboreto","abril fatface","abyssinica sil","aclonica","acme","actor","adamina","advent pro","afacad","afacad flux","agbalumo","agdasima","agu display","aguafina script","akatab","akaya kanadaka","akaya telivigala","akronim","akshar","aladin","alan sans","alata","alatsi","albert sans","aldrich","alef","alegreya","alegreya sc","alegreya sans","alegreya sans sc","aleo","alex brush","alexandria","alfa slab one","alice","alike","alike angular","alkalami","alkatra","allan","allerta","allerta stencil","allison","allura","almarai","almendra","almendra display","almendra sc","alumni sans","alumni sans collegiate one","alumni sans inline one","alumni sans pinstripe","alumni sans sc","amarante","amaranth","amatic sc","amethysta","amiko","amiri","amiri quran","amita","anaheim","ancizar sans","ancizar serif","andada pro","andika","anek bangla","anek devanagari","anek gujarati","anek gurmukhi","anek kannada","anek latin","anek malayalam","anek odia","anek tamil","anek telugu","angkor","annapurna sil","annie use your telescope","anonymous pro","anta","antic","antic didone","antic slab","anton","anton sc","antonio","anuphan","anybody","aoboshi one","arapey","arbutus","arbutus slab","architects daughter","archivo","archivo black","archivo narrow","are you serious","aref ruqaa","aref ruqaa ink","arima","arimo","arizonia","armata","arsenal","arsenal sc","artifika","arvo","arya","asap","asap condensed","asar","asimovian","asset","assistant","asta sans","astloch","asul","athiti","atkinson hyperlegible","atkinson hyperlegible mono","atkinson hyperlegible next","atma","atomic age","aubrey","audiowide","autour one","average","average sans","averia gruesa libre","averia libre","averia sans libre","averia serif libre","azeret mono","b612","b612 mono","biz udgothic","biz udmincho","biz udpgothic","biz udpmincho","babylonica","bacasime antique","bad script","badeen display","bagel fat one","bahiana","bahianita","bai jamjuree","bakbak one","ballet","baloo 2","baloo bhai 2","baloo bhaijaan 2","baloo bhaina 2","baloo chettan 2","baloo da 2","baloo paaji 2","baloo tamma 2","baloo tammudu 2","baloo thambi 2","balsamiq sans","balthazar","bangers","barlow","barlow condensed","barlow semi condensed","barriecito","barrio","basic","baskervville","baskervville sc","battambang","baumans","bayon","be vietnam pro","beau rivage","bebas neue","beiruti","belanosima","belgrano","bellefair","belleza","bellota","bellota text","benchnine","benne","bentham","berkshire swash","besley","beth ellen","bevan","bhutuka expanded one","big shoulders","big shoulders inline","big shoulders stencil","bigelow rules","bigshot one","bilbo","bilbo swash caps","biorhyme","biorhyme expanded","birthstone","birthstone bounce","biryani","bitcount","bitcount grid double","bitcount grid double ink","bitcount grid single","bitcount grid single ink","bitcount ink","bitcount prop double","bitcount prop double ink","bitcount prop single","bitcount prop single ink","bitcount single","bitcount single ink","bitter","black and white picture","black han sans","black ops one","blaka","blaka hollow","blaka ink","blinker","bodoni moda","bodoni moda sc","bokor","boldonse","bona nova","bona nova sc","bonbon","bonheur royale","boogaloo","borel","bowlby one","bowlby one sc","braah one","brawler","bree serif","bricolage grotesque","bruno ace","bruno ace sc","brygada 1918","bubblegum sans","bubbler one","buda","buenard","bungee","bungee hairline","bungee inline","bungee outline","bungee shade","bungee spice","bungee tint","butcherman","butterfly kids","bytesized","cabin","cabin condensed","cabin sketch","cactus classical serif","caesar dressing","cagliostro","cairo","cairo play","cal sans","caladea","calistoga","calligraffitti","cambay","cambo","candal","cantarell","cantata one","cantora one","caprasimo","capriola","caramel","carattere","cardo","carlito","carme","carrois gothic","carrois gothic sc","carter one","cascadia code","cascadia mono","castoro","castoro titling","catamaran","caudex","caveat","caveat brush","cedarville cursive","ceviche one","chakra petch","changa","changa one","chango","charis sil","charm","charmonman","chathura","chau philomene one","chela one","chelsea market","chenla","cherish","cherry bomb one","cherry cream soda","cherry swash","chewy","chicle","chilanka","chiron goround tc","chiron hei hk","chiron sung hk","chivo","chivo mono","chocolate classical sans","chokokutai","chonburi","cinzel","cinzel decorative","clicker script","climate crisis","coda","codystar","coiny","combo","comfortaa","comforter","comforter brush","comic neue","comic relief","coming soon","comme","commissioner","concert one","condiment","content","contrail one","convergence","cookie","copse","coral pixels","corben","corinthia","cormorant","cormorant garamond","cormorant infant","cormorant sc","cormorant unicase","cormorant upright","cossette texte","cossette titre","courgette","courier prime","cousine","coustard","covered by your grace","crafty girls","creepster","crete round","crimson pro","crimson text","croissant one","crushed","cuprum","cute font","cutive","cutive mono","dm mono","dm sans","dm serif display","dm serif text","dai banna sil","damion","dancing script","danfo","dangrek","darker grotesque","darumadrop one","david libre","dawning of a new day","days one","dekko","dela gothic one","delicious handrawn","delius","delius swash caps","delius unicase","della respira","denk one","devonshire","dhurjati","didact gothic","diphylleia","diplomata","diplomata sc","do hyeon","dokdo","domine","donegal one","dongle","doppio one","dorsa","dosis","dotgothic16","doto","dr sugiyama","duru sans","dynapuff","dynalight","eb garamond","eagle lake","east sea dokdo","eater","economica","eczar","edu au vic wa nt arrows","edu au vic wa nt dots","edu au vic wa nt guides","edu au vic wa nt hand","edu au vic wa nt pre","edu nsw act cursive","edu nsw act foundation","edu nsw act hand pre","edu qld beginner","edu qld hand","edu sa beginner","edu sa hand","edu tas beginner","edu vic wa nt beginner","edu vic wa nt hand","edu vic wa nt hand pre","el messiri","electrolize","elsie","elsie swash caps","emblema one","emilys candy","encode sans","encode sans condensed","encode sans expanded","encode sans sc","encode sans semi condensed","encode sans semi expanded","engagement","englebert","enriqueta","ephesis","epilogue","epunda sans","epunda slab","erica one","esteban","estonia","euphoria script","ewert","exile","exo","exo 2","expletus sans","explora","faculty glyphic","fahkwang","familjen grotesk","fanwood text","farro","farsan","fascinate","fascinate inline","faster one","fasthand","fauna one","faustina","federant","federo","felipa","fenix","festive","figtree","finger paint","finlandica","fira code","fira mono","fira sans","fira sans condensed","fira sans extra condensed","fjalla one","fjord one","flamenco","flavors","fleur de leah","flow block","flow circular","flow rounded","foldit","fondamento","fontdiner swanky","forum","fragment mono","francois one","frank ruhl libre","fraunces","freckle face","fredericka the great","fredoka","freehand","freeman","fresca","frijole","fruktur","fugaz one","fuggles","funnel display","funnel sans","fustat","fuzzy bubbles","gfs didot","gfs neohellenic","ga maamli","gabarito","gabriela","gaegu","gafata","gajraj one","galada","galdeano","galindo","gamja flower","gantari","gasoek one","gayathri","geist","geist mono","gelasio","gemunu libre","genos","gentium book plus","gentium plus","geo","geologica","georama","geostar","geostar fill","germania one","gideon roman","gidole","gidugu","gilda display","girassol","give you glory","glass antiqua","glegoo","gloock","gloria hallelujah","glory","gluten","goblin one","gochi hand","goldman","golos text","google sans code","gorditas","gothic a1","gotu","goudy bookletter 1911","gowun batang","gowun dodum","graduate","grand hotel","grandiflora one","grandstander","grape nuts","gravitas one","great vibes","grechen fuemen","grenze","grenze gotisch","grey qo","griffy","gruppo","gudea","gugi","gulzar","gupter","gurajada","gwendolyn","habibi","hachi maru pop","hahmlet","halant","hammersmith one","hanalei","hanalei fill","handjet","handlee","hanken grotesk","hanuman","happy monkey","harmattan","headland one","hedvig letters sans","hedvig letters serif","heebo","henny penny","hepta slab","herr von muellerhoff","hi melody","hina mincho","hind","hind guntur","hind madurai","hind mysuru","hind siliguri","hind vadodara","holtwood one sc","homemade apple","homenaje","honk","host grotesk","hubballi","hubot sans","huninn","hurricane","ibm plex mono","ibm plex sans","ibm plex sans arabic","ibm plex sans condensed","ibm plex sans devanagari","ibm plex sans hebrew","ibm plex sans jp","ibm plex sans kr","ibm plex sans thai","ibm plex sans thai looped","ibm plex serif","im fell dw pica","im fell dw pica sc","im fell double pica","im fell double pica sc","im fell english","im fell english sc","im fell french canon","im fell french canon sc","im fell great primer","im fell great primer sc","iansui","ibarra real nova","iceberg","iceland","imbue","imperial script","imprima","inclusive sans","inconsolata","inder","indie flower","ingrid darling","inika","inknut antiqua","inria sans","inria serif","inspiration","instrument sans","instrument serif","intel one mono","inter","inter tight","irish grover","island moments","istok web","italiana","italianno","itim","jacquard 12","jacquard 12 charted","jacquard 24","jacquard 24 charted","jacquarda bastarda 9","jacquarda bastarda 9 charted","jacques francois","jacques francois shadow","jaini","jaini purva","jaldi","jaro","jersey 10","jersey 10 charted","jersey 15","jersey 15 charted","jersey 20","jersey 20 charted","jersey 25","jersey 25 charted","jetbrains mono","jim nightshade","joan","jockey one","jolly lodger","jomhuria","jomolhari","josefin sans","josefin slab","jost","joti one","jua","judson","julee","julius sans one","junge","jura","just another hand","just me again down here","k2d","kablammo","kadwa","kaisei decol","kaisei harunoumi","kaisei opti","kaisei tokumin","kalam","kalnia","kalnia glaze","kameron","kanchenjunga","kanit","kantumruy pro","kapakana","karantina","karla","karla tamil inclined","karla tamil upright","karma","katibeh","kaushan script","kavivanar","kavoon","kay pho du","kdam thmor pro","keania one","kelly slab","kenia","khand","khmer","khula","kings","kirang haerang","kite one","kiwi maru","klee one","knewave","koho","kodchasan","kode mono","koh santepheap","kolker brush","konkhmer sleokchher","kosugi","kosugi maru","kotta one","koulen","kranky","kreon","kristi","krona one","krub","kufam","kulim park","kumar one","kumar one outline","kumbh sans","kurale","lxgw marker gothic","lxgw wenkai mono tc","lxgw wenkai tc","la belle aurore","labrada","lacquer","laila","lakki reddy","lalezar","lancelot","langar","lateef","lato","lavishly yours","league gothic","league script","league spartan","leckerli one","ledger","lekton","lemon","lemonada","lexend","lexend deca","lexend exa","lexend giga","lexend mega","lexend peta","lexend tera","lexend zetta","libertinus keyboard","libertinus math","libertinus mono","libertinus sans","libertinus serif","libertinus serif display","libre barcode 128","libre barcode 128 text","libre barcode 39","libre barcode 39 extended","libre barcode 39 extended text","libre barcode 39 text","libre barcode ean13 text","libre baskerville","libre bodoni","libre caslon display","libre caslon text","libre franklin","licorice","life savers","lilita one","lily script one","limelight","linden hill","linefont","lisu bosa","liter","literata","liu jian mao cao","livvic","lobster","lobster two","londrina outline","londrina shadow","londrina sketch","londrina solid","long cang","lora","love light","love ya like a sister","loved by the king","lovers quarrel","luckiest guy","lugrasimo","lumanosimo","lunasima","lusitana","lustria","luxurious roman","luxurious script","m plus 1","m plus 1 code","m plus 1p","m plus 2","m plus code latin","m plus rounded 1c","ma shan zheng","macondo","macondo swash caps","mada","madimi one","magra","maiden orange","maitree","major mono display","mako","mali","mallanna","maname","mandali","manjari","manrope","mansalva","manuale","manufacturing consent","marcellus","marcellus sc","marck script","margarine","marhey","markazi text","marko one","marmelad","martel","martel sans","martian mono","marvel","matangi","mate","mate sc","matemasie","maven pro","mclaren","mea culpa","meddon","medievalsharp","medula one","meera inimai","megrim","meie script","menbere","meow script","merienda","merriweather","merriweather sans","metal","metal mania","metamorphous","metrophobic","michroma","micro 5","micro 5 charted","milonga","miltonian","miltonian tattoo","mina","mingzat","miniver","miriam libre","mirza","miss fajardose","mitr","mochiy pop one","mochiy pop p one","modak","modern antiqua","moderustic","mogra","mohave","moirai one","molengo","molle","mona sans","monda","monofett","monomakh","monomaniac one","monoton","monsieur la doulaise","montaga","montagu slab","montecarlo","montez","montserrat","montserrat alternates","montserrat underline","moo lah lah","mooli","moon dance","moul","moulpali","mountains of christmas","mouse memoirs","mozilla headline","mozilla text","mr bedfort","mr dafoe","mr de haviland","mrs saint delafield","mrs sheppards","ms madi","mukta","mukta mahee","mukta malar","mukta vaani","mulish","murecho","museomoderno","my soul","mynerve","mystery quest","ntr","nabla","namdhinggo","nanum brush script","nanum gothic","nanum gothic coding","nanum myeongjo","nanum pen script","narnoor","nata sans","national park","neonderthaw","nerko one","neucha","neuton","new amsterdam","new rocker","new tegomin","news cycle","newsreader","niconne","niramit","nixie one","nobile","nokora","norican","nosifer","notable","nothing you could do","noticia text","noto color emoji","noto emoji","noto kufi arabic","noto music","noto naskh arabic","noto nastaliq urdu","noto rashi hebrew","noto sans","noto sans adlam","noto sans adlam unjoined","noto sans anatolian hieroglyphs","noto sans arabic","noto sans armenian","noto sans avestan","noto sans balinese","noto sans bamum","noto sans bassa vah","noto sans batak","noto sans bengali","noto sans bhaiksuki","noto sans brahmi","noto sans buginese","noto sans buhid","noto sans canadian aboriginal","noto sans carian","noto sans caucasian albanian","noto sans chakma","noto sans cham","noto sans cherokee","noto sans chorasmian","noto sans coptic","noto sans cuneiform","noto sans cypriot","noto sans cypro minoan","noto sans deseret","noto sans devanagari","noto sans display","noto sans duployan","noto sans egyptian hieroglyphs","noto sans elbasan","noto sans elymaic","noto sans ethiopic","noto sans georgian","noto sans glagolitic","noto sans gothic","noto sans grantha","noto sans gujarati","noto sans gunjala gondi","noto sans gurmukhi","noto sans hk","noto sans hanifi rohingya","noto sans hanunoo","noto sans hatran","noto sans hebrew","noto sans imperial aramaic","noto sans indic siyaq numbers","noto sans inscriptional pahlavi","noto sans inscriptional parthian","noto sans jp","noto sans javanese","noto sans kr","noto sans kaithi","noto sans kannada","noto sans kawi","noto sans kayah li","noto sans kharoshthi","noto sans khmer","noto sans khojki","noto sans khudawadi","noto sans lao","noto sans lao looped","noto sans lepcha","noto sans limbu","noto sans linear a","noto sans linear b","noto sans lisu","noto sans lycian","noto sans lydian","noto sans mahajani","noto sans malayalam","noto sans mandaic","noto sans manichaean","noto sans marchen","noto sans masaram gondi","noto sans math","noto sans mayan numerals","noto sans medefaidrin","noto sans meetei mayek","noto sans mende kikakui","noto sans meroitic","noto sans miao","noto sans modi","noto sans mongolian","noto sans mono","noto sans mro","noto sans multani","noto sans myanmar","noto sans nko","noto sans nko unjoined","noto sans nabataean","noto sans nag mundari","noto sans nandinagari","noto sans new tai lue","noto sans newa","noto sans nushu","noto sans ogham","noto sans ol chiki","noto sans old hungarian","noto sans old italic","noto sans old north arabian","noto sans old permic","noto sans old persian","noto sans old sogdian","noto sans old south arabian","noto sans old turkic","noto sans oriya","noto sans osage","noto sans osmanya","noto sans pahawh hmong","noto sans palmyrene","noto sans pau cin hau","noto sans phagspa","noto sans phoenician","noto sans psalter pahlavi","noto sans rejang","noto sans runic","noto sans sc","noto sans samaritan","noto sans saurashtra","noto sans sharada","noto sans shavian","noto sans siddham","noto sans signwriting","noto sans sinhala","noto sans sogdian","noto sans sora sompeng","noto sans soyombo","noto sans sundanese","noto sans sunuwar","noto sans syloti nagri","noto sans symbols","noto sans symbols 2","noto sans syriac","noto sans syriac eastern","noto sans tc","noto sans tagalog","noto sans tagbanwa","noto sans tai le","noto sans tai tham","noto sans tai viet","noto sans takri","noto sans tamil","noto sans tamil supplement","noto sans tangsa","noto sans telugu","noto sans thaana","noto sans thai","noto sans thai looped","noto sans tifinagh","noto sans tirhuta","noto sans ugaritic","noto sans vai","noto sans vithkuqi","noto sans wancho","noto sans warang citi","noto sans yi","noto sans zanabazar square","noto serif","noto serif ahom","noto serif armenian","noto serif balinese","noto serif bengali","noto serif devanagari","noto serif display","noto serif dives akuru","noto serif dogra","noto serif ethiopic","noto serif georgian","noto serif grantha","noto serif gujarati","noto serif gurmukhi","noto serif hk","noto serif hebrew","noto serif hentaigana","noto serif jp","noto serif kr","noto serif kannada","noto serif khitan small script","noto serif khmer","noto serif khojki","noto serif lao","noto serif makasar","noto serif malayalam","noto serif myanmar","noto serif np hmong","noto serif old uyghur","noto serif oriya","noto serif ottoman siyaq","noto serif sc","noto serif sinhala","noto serif tc","noto serif tamil","noto serif tangut","noto serif telugu","noto serif thai","noto serif tibetan","noto serif todhri","noto serif toto","noto serif vithkuqi","noto serif yezidi","noto traditional nushu","noto znamenny musical notation","nova cut","nova flat","nova mono","nova oval","nova round","nova script","nova slim","nova square","numans","nunito","nunito sans","nuosu sil","odibee sans","odor mean chey","offside","oi","ojuju","old standard tt","oldenburg","ole","oleo script","oleo script swash caps","onest","oooh baby","open sans","oranienbaum","orbit","orbitron","oregano","orelega one","orienta","original surfer","oswald","outfit","over the rainbow","overlock","overlock sc","overpass","overpass mono","ovo","oxanium","oxygen","oxygen mono","pt mono","pt sans","pt sans caption","pt sans narrow","pt serif","pt serif caption","pacifico","padauk","padyakke expanded one","palanquin","palanquin dark","palette mosaic","pangolin","paprika","parastoo","parisienne","parkinsans","passero one","passion one","passions conflict","pathway extreme","pathway gothic one","patrick hand","patrick hand sc","pattaya","patua one","pavanam","paytone one","peddana","peralta","permanent marker","petemoss","petit formal script","petrona","phetsarath","philosopher","phudu","piazzolla","piedra","pinyon script","pirata one","pixelify sans","plaster","platypi","play","playball","playfair","playfair display","playfair display sc","playpen sans","playpen sans arabic","playpen sans deva","playpen sans hebrew","playpen sans thai","playwrite ar","playwrite ar guides","playwrite at","playwrite at guides","playwrite au nsw","playwrite au nsw guides","playwrite au qld","playwrite au qld guides","playwrite au sa","playwrite au sa guides","playwrite au tas","playwrite au tas guides","playwrite au vic","playwrite au vic guides","playwrite be vlg","playwrite be vlg guides","playwrite be wal","playwrite be wal guides","playwrite br","playwrite br guides","playwrite ca","playwrite ca guides","playwrite cl","playwrite cl guides","playwrite co","playwrite co guides","playwrite cu","playwrite cu guides","playwrite cz","playwrite cz guides","playwrite de grund","playwrite de grund guides","playwrite de la","playwrite de la guides","playwrite de sas","playwrite de sas guides","playwrite de va","playwrite de va guides","playwrite dk loopet","playwrite dk loopet guides","playwrite dk uloopet","playwrite dk uloopet guides","playwrite es","playwrite es deco","playwrite es deco guides","playwrite es guides","playwrite fr moderne","playwrite fr moderne guides","playwrite fr trad","playwrite fr trad guides","playwrite gb j","playwrite gb j guides","playwrite gb s","playwrite gb s guides","playwrite hr","playwrite hr guides","playwrite hr lijeva","playwrite hr lijeva guides","playwrite hu","playwrite hu guides","playwrite id","playwrite id guides","playwrite ie","playwrite ie guides","playwrite in","playwrite in guides","playwrite is","playwrite is guides","playwrite it moderna","playwrite it moderna guides","playwrite it trad","playwrite it trad guides","playwrite mx","playwrite mx guides","playwrite ng modern","playwrite ng modern guides","playwrite nl","playwrite nl guides","playwrite no","playwrite no guides","playwrite nz","playwrite nz guides","playwrite pe","playwrite pe guides","playwrite pl","playwrite pl guides","playwrite pt","playwrite pt guides","playwrite ro","playwrite ro guides","playwrite sk","playwrite sk guides","playwrite tz","playwrite tz guides","playwrite us modern","playwrite us modern guides","playwrite us trad","playwrite us trad guides","playwrite vn","playwrite vn guides","playwrite za","playwrite za guides","plus jakarta sans","pochaevsk","podkova","poetsen one","poiret one","poller one","poltawski nowy","poly","pompiere","ponnala","ponomar","pontano sans","poor story","poppins","port lligat sans","port lligat slab","potta one","pragati narrow","praise","prata","preahvihear","press start 2p","pridi","princess sofia","prociono","prompt","prosto one","protest guerrilla","protest revolution","protest riot","protest strike","proza libre","public sans","puppies play","puritan","purple purse","qahiri","quando","quantico","quattrocento","quattrocento sans","questrial","quicksand","quintessential","qwigley","qwitcher grypen","rem","racing sans one","radio canada","radio canada big","radley","rajdhani","rakkas","raleway","raleway dots","ramabhadra","ramaraja","rambla","rammetto one","rampart one","ranchers","rancho","ranga","rasa","rationale","ravi prakash","readex pro","recursive","red hat display","red hat mono","red hat text","red rose","redacted","redacted script","reddit mono","reddit sans","reddit sans condensed","redressed","reem kufi","reem kufi fun","reem kufi ink","reenie beanie","reggae one","rethink sans","revalia","rhodium libre","ribeye","ribeye marrow","righteous","risque","road rage","roboto","roboto condensed","roboto flex","roboto mono","roboto serif","roboto slab","rochester","rock 3d","rock salt","rocknroll one","rokkitt","romanesco","ropa sans","rosario","rosarivo","rouge script","rowdies","rozha one","rubik","rubik 80s fade","rubik beastly","rubik broken fax","rubik bubbles","rubik burned","rubik dirt","rubik distressed","rubik doodle shadow","rubik doodle triangles","rubik gemstones","rubik glitch","rubik glitch pop","rubik iso","rubik lines","rubik maps","rubik marker hatch","rubik maze","rubik microbe","rubik mono one","rubik moonrocks","rubik pixels","rubik puddles","rubik scribble","rubik spray paint","rubik storm","rubik vinyl","rubik wet paint","ruda","rufina","ruge boogie","ruluko","rum raisin","ruslan display","russo one","ruthie","ruwudu","rye","stix two text","suse","suse mono","sacramento","sahitya","sail","saira","saira condensed","saira extra condensed","saira semi condensed","saira stencil one","salsa","sanchez","sancreek","sankofa display","sansation","sansita","sansita swashed","sarabun","sarala","sarina","sarpanch","sassy frass","satisfy","savate","sawarabi gothic","sawarabi mincho","scada","scheherazade new","schibsted grotesk","schoolbell","scope one","seaweed script","secular one","sedan","sedan sc","sedgwick ave","sedgwick ave display","sen","send flowers","sevillana","seymour one","shadows into light","shadows into light two","shafarik","shalimar","shantell sans","shanti","share","share tech","share tech mono","shippori antique","shippori antique b1","shippori mincho","shippori mincho b1","shizuru","shojumaru","short stack","shrikhand","siemreap","sigmar","sigmar one","signika","signika negative","silkscreen","simonetta","single day","sintony","sirin stencil","sirivennela","six caps","sixtyfour","sixtyfour convergence","skranji","slabo 13px","slabo 27px","slackey","slackside one","smokum","smooch","smooch sans","smythe","sniglet","snippet","snowburst one","sofadi one","sofia","sofia sans","sofia sans condensed","sofia sans extra condensed","sofia sans semi condensed","solitreo","solway","sometype mono","song myung","sono","sonsie one","sora","sorts mill goudy","sour gummy","source code pro","source sans 3","source serif 4","space grotesk","space mono","special elite","special gothic","special gothic condensed one","special gothic expanded one","spectral","spectral sc","spicy rice","spinnaker","spirax","splash","spline sans","spline sans mono","squada one","square peg","sree krushnadevaraya","sriracha","srisakdi","staatliches","stalemate","stalinist one","stardos stencil","stick","stick no bills","stint ultra condensed","stint ultra expanded","stoke","story script","strait","style script","stylish","sue ellen francisco","suez one","sulphur point","sumana","sunflower","sunshiney","supermercado one","sura","suranna","suravaram","suwannaphum","swanky and moo moo","syncopate","syne","syne mono","syne tactile","tasa explorer","tasa orbiter","tac one","tagesschrift","tai heritage pro","tajawal","tangerine","tapestry","taprom","tauri","taviraj","teachers","teko","tektur","telex","tenali ramakrishna","tenor sans","text me one","texturina","thasadith","the girl next door","the nautigal","tienne","tiktok sans","tillana","tilt neon","tilt prism","tilt warp","timmana","tinos","tiny5","tiro bangla","tiro devanagari hindi","tiro devanagari marathi","tiro devanagari sanskrit","tiro gurmukhi","tiro kannada","tiro tamil","tiro telugu","tirra","titan one","titillium web","tomorrow","tourney","trade winds","train one","triodion","trirong","trispace","trocchi","trochut","truculenta","trykker","tsukimi rounded","tuffy","tulpen one","turret road","twinkle star","ubuntu","ubuntu condensed","ubuntu mono","ubuntu sans","ubuntu sans mono","uchen","ultra","unbounded","uncial antiqua","underdog","unica one","unifrakturcook","unifrakturmaguntia","unkempt","unlock","unna","uoqmunthenkhung","updock","urbanist","vt323","vampiro one","varela","varela round","varta","vast shadow","vazirmatn","vend sans","vesper libre","viaoda libre","vibes","vibur","victor mono","vidaloka","viga","vina sans","voces","volkhov","vollkorn","vollkorn sc","voltaire","vujahday script","wdxl lubrifont jp n","wdxl lubrifont sc","wdxl lubrifont tc","waiting for the sunrise","wallpoet","walter turncoat","warnes","water brush","waterfall","wavefont","wellfleet","wendy one","whisper","windsong","winky rough","winky sans","wire one","wittgenstein","wix madefor display","wix madefor text","work sans","workbench","xanh mono","yaldevi","yanone kaffeesatz","yantramanav","yarndings 12","yarndings 12 charted","yarndings 20","yarndings 20 charted","yatra one","yellowtail","yeon sung","yeseva one","yesteryear","yomogi","young serif","yrsa","ysabeau","ysabeau infant","ysabeau office","ysabeau sc","yuji boku","yuji hentaigana akari","yuji hentaigana akebono","yuji mai","yuji syuku","yusei magic","zcool kuaile","zcool qingke huangyou","zcool xiaowei","zain","zalando sans","zalando sans expanded","zalando sans semiexpanded","zen antique","zen antique soft","zen dots","zen kaku gothic antique","zen kaku gothic new","zen kurenaido","zen loop","zen maru gothic","zen old mincho","zen tokyo zoo","zeyada","zhi mang xing","zilla slab","zilla slab highlight"];    

    // from https://www.indesignjs.de/extendscriptAPI/indesign-latest/index.html#FontTypes.html
    var fontTypeDict = {
        1718894932:"ATC",
        1718895209:"Bitmap",
        1718895433:"CID",
        1718898499:"OCF",
        1718898502:"OpenType CFF",
        1718898505:"OpenType CID",
        1718898516:"OpenType TT",
        1718899796:"TrueType",
        1718899761:"Type 1",
        1433299822:"Unknown"
    }

    // begin script
    $.writeln("beginning Font Usage Report")
    if (app.documents.length === 0) {
        alert("No document open.");
        return;
    }
    var doc = app.activeDocument;

    var panelName = "Macmillan Font Usage Report v" + version;
    var pal = getOrCreatePalette(panelName);

    if (!pal._constructed) {
        pal.orientation = "column";
        pal.alignChildren = ["fill", "fill"];
        pal.spacing = 8;
        pal.margins = 10;

        // Top controls (Create Report placed to the right of Scan Document)
        var grpTop = pal.add("group");
        grpTop.orientation = "row";
        grpTop.alignChildren = ["left", "center"];
        grpTop.alignment = ["fill", "top"];

        var btnScan = grpTop.add("button", undefined, "Scan Document");
        btnScan.alignment = ["left", "top"];

        var btnReport = grpTop.add("button", undefined, "Create Report");
        btnReport.alignment = ["left", "top"];

        // Central list (Pages column removed)
        var listBox = pal.add("listbox", undefined, [], {
            numberOfColumns: 4,
            showHeaders: true,
            columnTitles: ["Font Family", "Style", "Source Tags", "System Font"],
            columnWidths: [220, 120, 340, 110]
        });
        listBox.minimumSize.height = 220;
        listBox.minimumSize.width = 650;
        listBox.alignment = ["fill", "fill"];

        // Store refs
        pal._btnScan = btnScan;
        pal._btnReport = btnReport;
        pal._list = listBox;

        // Enable dynamic resize behavior
        makePanelResizable(pal);

        pal._constructed = true;
    }

    // Events
    pal._btnScan.onClick = function () {
        // close and re-scan current active doc
        pal.close();
        var thisDoc = app.activeDocument
        var data = scanFonts(thisDoc);
        pal._fontData = data;
        populateList(pal._list, data);
        pal.show();
    };

    pal._btnReport.onClick = function () {
        // maybe comment this \/? if we do a dialog
        // Ensure data is available
        if (!pal._fontData) {
            var data = scanFonts(doc);
            pal._fontData = data;
            populateList(pal._list, data);
        }

        // Alert if Google Fonts detected
        var gfInfo = detectGoogleFonts(pal._fontData);
        if (gfInfo.count > 0) {
            var msg = "Google Fonts detected (" + gfInfo.count + "):\n- " + gfInfo.names.join("\n- ") + "\n\nProceed to create the report?";
            if (!confirm(msg)) {
                return; // user cancelled
            }
        }

        var report = exportCSV(doc, pal._fontData);
        if (report && report.fileObj && report.fileObj.exists) {
            try {
                report.fileObj.execute(); // Open the CSV
            } catch (e) {
                alert("Report saved, but could not be opened automatically.\n" + report.fileObj.fsName);
            }
        }
    };

    // Initial scan + show
    // function scanAndShow()
    var initialData = scanFonts(doc);
    pal._fontData = initialData;
    populateList(pal._list, initialData);
    if (pal instanceof Window) pal.show();


    // ===== UI helpers =====
    function getOrCreatePalette(name) {
        var w;
        try {
            $.writeln("success on ui")
            if (interactiveDev === true) {
                w = new Window("dialog", name, undefined, {resizeable:true});
            } else {
                w = new Window("palette", name, undefined, {resizeable:true});
            }
            // w = new Window("dialog", name, undefined, {maximizeButton:true, closeButton:true, resizeable:true});
        } catch (e) {
            w = new Window("palette", name);
        }
        w.text = name;
        return w;
    }

    // Make panel resizable and columns adaptive
    function makePanelResizable(win) {
        win.layout.layout(true);
        win.layout.resize();
        win.onResizing = win.onResize = function () {
            try {
                this.layout.resize();
                autosizeColumns(this._list);
            } catch (_e) {}
        };
        autosizeColumns(win._list);
    }

    function autosizeColumns(list) {
        if (!list || !list.visible) return;
        var totalW = list.size && list.size.width ? list.size.width : (list.bounds[2] - list.bounds[0]);
        var padding = 28;
        var usable = totalW - padding;
        if (usable < 360) usable = 360;

        // With Pages removed, redistribute weights across 5 columns:
        // [Family, Style, Status, Source Tags, System]
        var weights = [3.2, 1.3, 1.0, 3.7, 1.2];
        var sum = 0;
        for (var i = 0; i < weights.length; i++) sum += weights[i];

        var widths = [];
        for (var j = 0; j < weights.length; j++) {
            widths[j] = Math.max(60, Math.floor(usable * (weights[j] / sum)));
        }

        try {
            list.columns[0].width = widths[0];
            list.columns[1].width = widths[1];
            list.columns[2].width = widths[2];
            list.columns[3].width = widths[3];
            list.columns[4].width = widths[4];
        } catch (_e) {}
        try { list.layout.layout(true); } catch (_e2) {}
    }

    function populateList(listBox, data) {
        listBox.removeAll();
        var keys = getObjectKeys(data.usedFonts);
        for (var i = 0; i < keys.length; i++) {
            var rec = data.usedFonts[keys[i]];
            var tags = buildSourceTags(rec);
            var item = listBox.add("item", safe(rec.family));
            item.subItems[0].text = safe(rec.style);
            // item.subItems[1].text = safe(rec.status);
            item.subItems[1].text = safe(tags);
            item.subItems[2].text = rec.isSystemFont ? "Yes" : "No";
        }
        if (listBox.items.length === 0) {
            var it = listBox.add("item", "(No fonts found in text)");
            it.subItems[0].text = "";
            it.subItems[1].text = "";
            it.subItems[2].text = "";
            // it.subItems[3].text = "";
        }
        autosizeColumns(listBox);
    }

    function buildSourceTags(rec) {
        var tags = [];
        if (rec.adobeFonts) tags.push("Adobe Font");
        if (rec.googleFonts) tags.push("Google Font");
        if (rec.utcFonts) tags.push("UTC Font");
        if (rec.localPackaged) tags.push("Local/Packaged");
        if (rec.placedAI) tags.push("Placed AI/EPS: " + rec.placedAI);
        return tags.join(", ");
    }

    function getFontMetadata(usedFonts, fontObj) {
        var meta = getFontMeta(fontObj);
        var key = meta.fontName !== "" ? meta.fontName : (meta.family + "___" + meta.style);
        
        if (!usedFonts[key]) {
            usedFonts[key] = {
                family: meta.family,
                style: meta.style,
                fontName: meta.fontName,
                foundry: meta.foundry,
                source: meta.source,
                adobeFonts: meta.isAdobeFonts ? "Adobe Font" : "",
                utcFonts: meta.isUtcFonts ? "UTC Font" : "",
                googleFonts: "",
                localPackaged: "",
                placedAI: "",
                status: meta.status,
                isSystemFont: meta.isSystemFont,
                fontType: meta.fontType
            };
        }
    }

    // ===== Core scans =====

    function find(myDocument, fname, fstyle) {
        //Clear the find/change text preferences.
            app.findGrepPreferences = NothingEnum.nothing;

        //Set the GREP find options (adjust to taste)
        app.findChangeGrepOptions.includeFootnotes = true;
        app.findChangeGrepOptions.includeHiddenLayers = true;
        app.findChangeGrepOptions.includeLockedLayersForFind = true;
        app.findChangeGrepOptions.includeLockedStoriesForFind = true;
        app.findChangeGrepOptions.includeMasterPages = true;

        //Look for the pattern and change to
        app.findGrepPreferences.appliedFont = fname;
        app.findGrepPreferences.fontStyle = fstyle;
        var found = myDocument.findGrep();

        //Clear the find/change text preferences.
        app.findGrepPreferences = NothingEnum.nothing;
        return found;
    }

    function deriveStyleNameFromFontName(fontname) {
        var fontstyleDerivedPt1 = fontname.split("\t")[1];
        var fontStyleDerivedA = fontstyleDerivedPt1.substring(0, fontstyleDerivedPt1.length/2);
        var fontStyleDerivedB = fontstyleDerivedPt1.substring(fontstyleDerivedPt1.length/2);
        // $.writeln("deriving: " +fontname+", 1: " + fontStyleDerivedA + ", 2: " + fontStyleDerivedB)

        // this check \/ tests derived stylename, since stylename is typically repeated at end of .name:
        if (fontStyleDerivedA == fontStyleDerivedB) {
            return fontStyleDerivedA;
        } else {
            // if font.style is blank, stylename is not repeated.
            return fontstyleDerivedPt1;
        }
    }

    function scanFontsWithFind(usedFonts, docRef) {

        //  get document font list
        var fonts = docRef.fonts;
        var unFoundFonts = [];
        
        // setup progressbar
        var w = new Window ('palette', "Scanning document fonts for metadata ...");
        w.pbar = w.add ('progressbar', undefined, 0, fonts.length);
        w.pbar.preferredSize.width = 300;
        w.show();

        // cycle through document fonts and get font info
        for (var i=0; i < fonts.length ; i++) {  

            getFontMetadata(usedFonts, docRef.fonts[i])

            w.pbar.value++;
        }
        
        return {"usedFonts": usedFonts, "unFoundFonts": unFoundFonts}
    }

    // ===== Scan fonts inside placed .ai files via BridgeTalk to Illustrator =====
    function scanPlacedAIFonts(docRef) {
        var placedAIFonts = {};
        var aiFilePaths = [];
        var seenPaths = {};

        // Collect unique .ai and .eps link paths
        var links = docRef.links;
        for (var i = 0; i < links.length; i++) {
            try {
                var fp = String(links[i].filePath);
                if (/\.(ai|eps)$/i.test(fp) && !seenPaths[fp]) {
                    seenPaths[fp] = true;
                    aiFilePaths.push(fp);
                }
            } catch (e) {}
        }

        if (aiFilePaths.length === 0) {
            $.writeln("No placed .ai or .eps files found in document");
            return placedAIFonts;
        }

        // Check BridgeTalk / Illustrator availability
        // Prefer scanning running targets since getAppSpecifier() is unreliable across versions
        var ilSpec = null;
        try {
            var _targets = BridgeTalk.getTargets();
            $.writeln("BridgeTalk running targets: " + (_targets ? _targets.join(", ") : "none"));
            if (_targets) {
                for (var _t = 0; _t < _targets.length; _t++) {
                    if (_targets[_t].toLowerCase().indexOf("illustrator") >= 0) {
                        ilSpec = _targets[_t];
                        break;
                    }
                }
            }
        } catch (e) { $.writeln("BridgeTalk.getTargets() error: " + e); }

        // Fall back to getAppSpecifier if not found in running targets
        if (!ilSpec) {
            try { ilSpec = BridgeTalk.getAppSpecifier("illustrator"); } catch (e) { ilSpec = null; }
        }
        // Last resort: try the bare name — BridgeTalk will resolve it if Illustrator is installed
        if (!ilSpec) { ilSpec = "illustrator"; }

        $.writeln("Using Illustrator BridgeTalk specifier: " + ilSpec);

        // Verify Illustrator actually responds before processing all files
        var _pingResult = null;
        var _ping = new BridgeTalk();
        _ping.target = ilSpec;
        _ping.body = '"pong"';
        _ping.onResult = function(r) { _pingResult = r.body; };
        _ping.onError  = function(e) { _pingResult = "ERROR"; $.writeln("Illustrator ping error: " + e.body); };
        _ping.send(10);
        var _pingDeadline = (new Date()).getTime() + 10000;
        while (_pingResult === null && (new Date()).getTime() < _pingDeadline) {
            $.sleep(200); BridgeTalk.pump();
        }
        if (_pingResult === null || _pingResult === "ERROR") {
            alert("Adobe Illustrator was not found or did not respond.\nMake sure Illustrator is open, then run the scan again.\n\nSkipping placed AI/EPS font scan (" + aiFilePaths.length + " file(s)).");
            return placedAIFonts;
        }
        $.writeln("Illustrator responded to ping (" + ilSpec + "); scanning " + aiFilePaths.length + " .ai/.eps file(s)");

        // Progress window
        var pw = new Window("palette", "Scanning placed AI/EPS files...");
        pw.add("statictext", undefined, "Opening each .ai/.eps file in Illustrator to read its fonts.");
        pw.pbar = pw.add("progressbar", undefined, 0, aiFilePaths.length);
        pw.pbar.preferredSize.width = 380;
        pw.show();

        for (var j = 0; j < aiFilePaths.length; j++) {
            var filePath = aiFilePaths[j];
            var pathParts = filePath.replace(/\\/g, "/").split("/");
            var fileName = pathParts[pathParts.length - 1];

            $.writeln("Querying AI file: " + fileName);

            // Script that runs inside Illustrator
            var escapedPath = filePath.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
            $.writeln("  Escaped path for Illustrator: " + escapedPath);
            var btBody =
                'var _out = [];' +
                'try {' +
                '    var _f = new File("' + escapedPath + '");' +
                '    _out.push("PATH:" + (_f.fsName || _f.fullName || "unknown"));' +
                '    if (!_f.exists) { _out.push("FILE_NOT_FOUND"); } else {' +
                '        var _doc = app.open(_f);' +
                '        if (!_doc) { _out.push("OPEN_FAILED"); } else {' +
                '            try {' +
                '                var _fontDict = {};' +
                '                var _tfCount = _doc.textFrames.length;' +
                '                _out.push("TEXTFRAMES:" + _tfCount);' +
                '                for (var _t = 0; _t < _tfCount; _t++) {' +
                '                    try {' +
                '                        var _tf = _doc.textFrames[_t];' +
                '                        if (_tf.textRange && _tf.textRange.characterAttributes) {' +
                '                            var _ca = _tf.textRange.characterAttributes;' +
                '                            var _font = _ca.textFont;' +
                '                            if (_font) {' +
                '                                var _fam = (_font.family || _font.name || "").toString();' +
                '                                var _sty = (_font.style || "").toString();' +
                '                                var _psn = (_font.name || _fam || "").toString();' +
                '                                var _key = _fam + ":::" + _sty;' +
                '                                if (!_fontDict[_key]) {' +
                '                                    _fontDict[_key] = _fam + "||" + _sty + "||" + _psn;' +
                '                                }' +
                '                            }' +
                '                        }' +
                '                    } catch (_tfe) {}' +
                '                }' +
                '                var _fontCount = 0;' +
                '                for (var _k in _fontDict) { _fontCount++; _out.push(_fontDict[_k]); }' +
                '                _out.push("FONTCOUNT:" + _fontCount);' +
                '            } catch (_fe) { _out.push("FONT_ERROR::" + _fe.toString()); }' +
                '            _doc.close(SaveOptions.DONOTSAVECHANGES);' +
                '        }' +
                '    }' +
                '} catch (_e) { _out.push("ERROR::" + _e.toString() + " LINE:" + (_e.line || "?")); }' +
                '_out.join(";;")';

            var rawResult = null;
            var bt = new BridgeTalk();
            bt.target = ilSpec;
            bt.body = btBody;
            bt.onResult = function(res) { rawResult = res.body; };
            bt.onError  = function(err) { rawResult = ""; $.writeln("BridgeTalk error scanning AI: " + err.body); };
            bt.send(60);

            // Poll until Illustrator responds (up to 60 seconds per file)
            var deadline = (new Date()).getTime() + 60000;
            while (rawResult === null && (new Date()).getTime() < deadline) {
                $.sleep(300);
                BridgeTalk.pump();
            }

            $.writeln("Raw BridgeTalk result from '" + fileName + "': " + rawResult);

            if (rawResult && rawResult !== "" &&
                rawResult.indexOf("ERROR::") < 0 &&
                rawResult !== "FILE_NOT_FOUND") {

                var entries = rawResult.split(";;");
                $.writeln("  Parsing " + entries.length + " entries from result");
                for (var k = 0; k < entries.length; k++) {
                    // Skip diagnostic entries
                    if (entries[k].indexOf("PATH:") === 0 || 
                        entries[k].indexOf("FONTCOUNT:") === 0 ||
                        entries[k].indexOf("FILE_NOT_FOUND") === 0 ||
                        entries[k].indexOf("OPEN_FAILED") === 0) {
                        $.writeln("    Diagnostic: " + entries[k]);
                        continue;
                    }
                    var ep = entries[k].split("||");
                    if (ep.length >= 3 && ep[0]) {
                        var fam = ep[0];
                        var sty = ep[1];
                        var psn = ep[2];
                        $.writeln("    Font " + k + ": family='" + fam + "', style='" + sty + "', ps='" + psn + "'");
                        var aiKey = (psn || (fam + "___" + sty)) + "___AI";
                        if (!placedAIFonts[aiKey]) {
                            placedAIFonts[aiKey] = {
                                family:       fam,
                                style:        sty,
                                fontName:     psn,
                                foundry:      deriveFoundry(fam, psn),
                                source:       "Placed AI/EPS File",
                                adobeFonts:   "",
                                utcFonts:     "",
                                googleFonts:  "",
                                localPackaged:"",
                                placedAI:     fileName,
                                status:       "Active",
                                isSystemFont: false,
                                fontType:     ""
                            };
                        } else if (placedAIFonts[aiKey].placedAI.indexOf(fileName) < 0) {
                            // Same font in multiple AI files
                            placedAIFonts[aiKey].placedAI += "; " + fileName;
                        }
                    }
                }
            } else {
                $.writeln("AI font scan unsuccessful for '" + fileName + "': " + rawResult);
            }

            pw.pbar.value = j + 1;
        }

        try { pw.close(); } catch(e) {}
        return placedAIFonts;
    }

    function scanFonts(docRef) {
        var usedFonts = {};
        var googleFontsSet = buildGoogleFontsDict();

        var results = scanFontsWithFind(usedFonts, docRef);
        usedFonts = results.usedFonts;

        // Check for AI/EPS files before scanning
        var hasAIorEPS = false;
        var links = docRef.links;
        for (var i = 0; i < links.length; i++) {
            try {
                var fp = String(links[i].filePath);
                if (/\.(ai|eps)$/i.test(fp)) {
                    hasAIorEPS = true;
                    break;
                }
            } catch (e) {}
        }

        // Ask user if they want to scan AI/EPS files
        var scanLinkedFiles = false;
        if (hasAIorEPS) {
            var msg = "This document contains placed AI and/or EPS files.\n\n" +
                      "To scan fonts inside these files, Adobe Illustrator must be installed and running.\n\n" +
                      "Would you like to scan linked AI/EPS files?\n\n" +
                      "• Click YES to scan linked files (requires Illustrator)\n" +
                      "• Click NO to skip and scan only InDesign fonts";
            scanLinkedFiles = confirm(msg);
        }

        // Merge fonts found inside placed .ai/.eps files (via BridgeTalk to Illustrator)
        if (scanLinkedFiles) {
            var aifonts = scanPlacedAIFonts(docRef);
            var inddKeys = getObjectKeys(usedFonts);
            var aiKeys = getObjectKeys(aifonts);
            for (var a = 0; a < aiKeys.length; a++) {
                var airec = aifonts[aiKeys[a]];
                // If the same font is already known from the InDesign doc, just annotate it
                var matched = false;
                for (var b = 0; b < inddKeys.length; b++) {
                    var inddRec = usedFonts[inddKeys[b]];
                    if (normalizeName(inddRec.family) === normalizeName(airec.family) &&
                        normalizeName(inddRec.style)  === normalizeName(airec.style)) {
                        inddRec.placedAI = airec.placedAI;
                        matched = true;
                        break;
                    }
                }
                // Font only appears inside the AI file - add as its own record
                if (!matched) usedFonts[aiKeys[a]] = airec;
            }
        }

        // Tag Google Fonts and Local/Packaged
        var kArr = getObjectKeys(usedFonts);
        for (var i = 0; i < kArr.length; i++) {
            var rec = usedFonts[kArr[i]];
            var famKey = normalizeName(rec.family);
            var psKey = normalizeName(rec.fontName);
            var isGoogle = false;
            if (googleFontsSet[famKey] === true || (psKey !== "" && googleFontsSet[psKey] === true)) {
                isGoogle = true;
            // capture unlisted variants (eg, '"Zalando Sans "Condensed' for 'Zalando Sans')
            } else {
                for (var gfont in googleFontsSet) {
                    if (rec.family.toLowerCase().indexOf(gfont + " ") == 0) {
                        isGoogle = true;
                    }
                }
            } 
            rec.googleFonts = isGoogle ? "Google Font" : "";            
            // $.writeln("fk: " + famKey, rec.status)
            // local Google fonts can falsely report as missing
            //  if they are activated through adobe they are not missing by default
            //  and if they truly are missing, they should be replaced as Google fonts anyways
            //  so to avoid confusion, marking them as not missing - MR
            if (isGoogle === true && rec.status == "Missing") {
                rec.status = "Active";
                rec.source = "Local/Packaged"
            }

            // We know Local/packaged based on previous discoveries
            // status
            if (!rec.adobeFonts && !rec.utcFonts && !rec.placedAI && rec.status != "Missing") rec.localPackaged = "Local/Packaged";
        }

        return { usedFonts: usedFonts, keys: kArr };
    }

    // Alert helper for Google Fonts summary
    function detectGoogleFonts(data) {
        var names = [];
        var count = 0;
        var keys = data.keys && data.keys.length ? data.keys : getObjectKeys(data.usedFonts);
        for (var i = 0; i < keys.length; i++) {
            var rec = data.usedFonts[keys[i]];
            if (rec && rec.googleFonts && rec.googleFonts !== "") {
                count++;
                names.push(rec.family + (rec.style ? " (" + rec.style + ")" : ""));
            }
        }
        if (names.length > 12) {
            // keep alert compact
            var shown = names.slice(0, 12);
            shown.push("...and " + (names.length - 12) + " more");
            names = shown;
        }
        return { count: count, names: names };
    }

    // ===== Export CSV (Pages column removed) and open it =====
    function exportCSV(docRef, data) {
        
        try {
            var indFile = docRef.fullName;
        } catch(e) {
            alert("Unable to determine this .indd file's path.\n Please save your Indesign file before trying to create its Font Usage report.");
            return null;
        }
        // If a package folder path was written by PackageFontReportTrigger, use it.
        // The path is passed via a temp file because $.global is not shared across doScript engines.
        var parentFolder;
        var tempPathFile = new File(Folder.temp.fsName + "/MacmillanFontReportSavePath.txt");
        if (tempPathFile.exists && tempPathFile.open("r")) {
            var savedPath = tempPathFile.read();
            tempPathFile.close();
            tempPathFile.remove();
            var customFolder = new Folder(savedPath);
            if (savedPath && customFolder.exists) {
                parentFolder = customFolder;
            } else {
                parentFolder = indFile.parent;
            }
        } else {
            parentFolder = indFile.parent;
        }

        var baseName = stripExtension(indFile.name);
        var outName = baseName + "_font_usage.csv";
        var csvFile = File(parentFolder.fsName + "/" + outName);

        var header = [
            "Font Family",
            "Style",
            "Font Name",
            "Foundry / Manufacturer",
            "Source",
            "Adobe Fonts",
            "UTC Fonts",
            "Google Fonts",
            "Local/Packaged",
            "Placed AI/EPS File",
            "System Font",
            "Status", 
            "Font Type"
        ].join(",");

        var lines = [header];

        var keys = data.keys && data.keys.length ? data.keys : getObjectKeys(data.usedFonts);
        for (var i = 0; i < keys.length; i++) {
            var rec = data.usedFonts[keys[i]];
            var row = [
                csvSafe(rec.family),
                csvSafe(rec.style),
                csvSafe(rec.fontName),
                csvSafe(rec.foundry),
                csvSafe(rec.source),
                csvSafe(rec.adobeFonts),
                csvSafe(rec.utcFonts),
                csvSafe(rec.googleFonts),
                csvSafe(rec.localPackaged),
                csvSafe(rec.placedAI || ""),
                csvSafe(rec.isSystemFont ? "Yes" : "No"),
                csvSafe(rec.status),
                csvSafe(rec.fontType)
            ].join(",");
            lines.push(row);
        }

        if (csvFile.exists) {
            if (!confirm(outName + " already exists next to the INDD file. Overwrite?")) {
                return null;
            }
        }

        if (csvFile.open("w")) {
            csvFile.encoding = "UTF-8";
            csvFile.write("\uFEFF");
            csvFile.write(lines.join("\r") + "\r");
            csvFile.close();
            $.writeln("CSV exported to: " + csvFile.fsName);
            return { fileObj: csvFile };
        } else {
            alert("Unable to write CSV:\n" + csvFile.error);
            return null;
        }
    }

    // ===== Font metadata helpers (with System Font detection) =====
    function getFontMeta(fontObj) {
        var family = "";
        var style = "";
        var fontName = "";
        var fontStatus = "";
        var source = "";
        var foundry = "";
        var isAdobeFonts = false;
        var isUtcFonts = false;
        var isSystemFont = false;
        var fontType = "";

        // basic font info
        try { family = safe(fontObj.fontFamily); } catch(_) {}
        // fontObj.fontStyleName is less reliable, sometimes completely wrong
        try { style = safe(deriveStyleNameFromFontName(fontObj.name)); } catch(_) {}
        try { fontName = safe(fontObj.postscriptName ? fontObj.postscriptName : fontObj.name); } catch(_) {}
        try { fontType = safe(fontObj.fontType ? fontObj.fontType : ""); } catch(_) {}

        // Missing status
        var missing = false;
        if (fontObj.status === FontStatus.NOT_AVAILABLE || fontObj.status === FontStatus.SUBSTITUTED) {
            missing = true;
        }
        fontStatus = missing ? "Missing" : "Active";

        // Adobe Fonts detection (heuristic)
        try { if (fontObj.hasOwnProperty("typekit")) isAdobeFonts = fontObj.typekit === true; } catch(_) {}
        try {
            if (!isAdobeFonts && fontObj.location) {
                if (String(fontObj.location) == "Activated from Adobe Fonts") isAdobeFonts = true;
                // if (String(fontObj.location).toLowerCase().indexOf("adobe") >= 0) isAdobeFonts = true;
            }
        } catch(_) {}

        // UTC font detection  
        try {
            if (fontObj.location) {
                var locationStr = String(fontObj.location);
                if (String(fontObj.location).indexOf("/Library/Extensis/UTC") >= 0) isUtcFonts = true;
            }
        } catch(_) {}
        
        // System font detection (best-effort)
        var locationStr = "";
        try { if (fontObj.location) locationStr = String(fontObj.location); } catch(_) {}
        var sysHints = ["/System/Library/Fonts", "/Library/Fonts", "~/Library/Fonts", "C:\\Windows\\Fonts", "/System/Fonts"];
        isSystemFont = containsAny(locationStr, sysHints);
        // This test is unlikely to uncover a sys font and could catch false positives, probably unnecessary \/, commenting -MR
        // if (!isSystemFont) {
        //     var nameProbe = (family + " " + fontName + " " + locationStr).toLowerCase();
        //     if (nameProbe.indexOf("system") >= 0) isSystemFont = true;
        // }

        // source, by process of elimiation:      
        if (isAdobeFonts === true) {
            source = "Adobe Font (Cloud Sync)";
        } else if (isUtcFonts === true) {
            source = "UTC font";
        } else if (isSystemFont === true) {
            source = "System font";
        } else if (fontStatus == "Missing") {
            source = "";
        } else {
            source = "Local/Packaged";
        }

        var foundry = deriveFoundry(family, fontName);

        return {
            family: family,
            style: style,
            fontName: fontName,
            status: fontStatus,
            source: source,
            foundry: foundry,
            isAdobeFonts: isAdobeFonts,
            isUtcFonts: isUtcFonts,
            isSystemFont: isSystemFont,
            fontType: fontType
        };
    }

    function deriveFoundry(family, psName) {
        var guess = "";
        var probes = [safe(psName), safe(family)];
        var tags = ["Adobe", "ITC", "Monotype", "Linotype", "URW", "ParaType", "FontBureau", "Hoefler", "House Industries", "TypeTogether", "FontFont", "Noto", "Google"];
        for (var p = 0; p < probes.length; p++) {
            var val = probes[p];
            var low = val.toLowerCase();
            for (var t = 0; t < tags.length; t++) {
                var tag = tags[t];
                if (low.indexOf(tag.toLowerCase()) >= 0) { guess = tag; break; }
            }
            if (guess !== "") break;
        }
        return guess;
    }

    function containsAny(haystack, arr) {
        var h = String(haystack || "");
        for (var i = 0; i < arr.length; i++) {
            if (h.indexOf(arr[i]) >= 0) return true;
        }
        return false;
    }

    // ===== Generic helpers =====
    function stripExtension(filename) {
        var n = filename;
        var idx = n.lastIndexOf(".");
        if (idx > 0) n = n.substring(0, idx);
        return n;
    }
    function getObjectKeys(o) {
        var ks = [];
        for (var k in o) if (o.hasOwnProperty(k)) ks.push(k);
        return ks;
    }
    function safe(v) {
        return v === undefined || v === null ? "" : String(v);
    }
    function csvSafe(v) {
        var txt = safe(v);
        if (txt.indexOf('"') >= 0 || txt.indexOf(",") >= 0 || txt.indexOf("\n") >= 0 || txt.indexOf("\r") >= 0) {
            txt = '"' + txt.replace(/"/g, '""') + '"';
        }
        return txt;
    }
    function normalizeName(name) {
        var t = safe(name).toLowerCase();
        t = t.replace(/[\s\-_]+/g, "");
        return t;
    }

    // ===== Google font check functions =====
    function gFontScrape () {   
        var myAppleScript = 'tell application id "com.adobe.indesign"\r' +
                            'set myData to do shell script "curl --connect-timeout 3 ' + gfonts_url + ' | grep -e family.: | sed \'s/^.*: //g\'"\r' +
                            'return myData\r' +
                            'end tell';
        var result = app.doScript(myAppleScript, ScriptLanguage.applescriptLanguage);
        return result.toString();
    }

    // returns true if below threshold
    function dateCompare(DtVal1, DtVal2, daysThreshold) {
        DaysDiff = Math.abs(DtVal1 - DtVal2)/ (1000 * 60 *60 *24); 
        // $.writeln(DaysDiff);
        if(DaysDiff < daysThreshold){ 
            return true;
        }else{
            return false;
        } 
    }

    function readFile(file) {
        file.open("r");
        contents = file.read();
        file.close();
        return contents;
    }

    function writeFile(file, contents) {
        file.encoding = 'UTF-8';
        file.open('w');
        file.write(contents);
        file.close();
    }

    function buildFontDict(list) {
        dict = {};
        // newList is just for writing a font list to console, to preserve as hardcoded list.
        // newlist = [];
        for (var i=0 ; i < list.length ; i++) {
            cleanedGFname = list[i].replace(/^\s+|\s+$/g,'').replace(/"/g,'').toLowerCase();
            listName = list[i].replace(/^\s+|\s+$/g,'').toLowerCase();
            if (cleanedGFname) {
                dict[cleanedGFname] = true;
                // newlist.push(listName);
                // add no-space versions of google fonts
                cleanedSansSpaces = cleanedGFname.replace(/ /g,'');
                if (cleanedGFname != cleanedSansSpaces) {                
                    dict[cleanedSansSpaces] = true;
                }
            }
        }      
        // $.writeln(newlist)
        return dict;
    }

    function testGfontDownload(gfontString) {
        var spotCheckValues = ["roboto", "lato", "raleway"];
        try {
            gfontList = gfontString.split(",");
            if (gfontList.length < 300) {
                $.writeln("scraped font list too short, data may be invalid")
                return false;
            } 
            gFontDict = buildFontDict(gfontList);
            for (var i = 0; i < spotCheckValues.length; i++) {
                if (gFontDict[spotCheckValues[i]] != true) {
                    $.writeln("scraped font list spotcheck failed, for fontname: " + spotCheckValues[i])
                    return false;
                }
            }
            $.writeln("fontname data looks valid")
            return true;
        } catch(e) {
            $.writeln(e+'error while validating scraped gfont list, returning false on validation')
            return false;
        }
    }

    function buildGoogleFontsDict() {
        // defaults
        var gfontString = "";
        var gfontList = [];
        var gfontDate = "";
        var date = new Date();
        var gfonts_cachefile = new File(gfonts_cacheFilepath);
        var gfonts_deployedCachefile = new File(gfonts_deployedFilePath);

        // get font list/string from curl or cache, prefer deployed file where present
        if (gfonts_deployedCachefile.exists) {
            $.writeln("found deployed gfontcachelist file, using that");
            gfontString = readFile(gfonts_deployedCachefile);
        } else if (gfonts_cachefile.exists && dateCompare(date, gfonts_cachefile.modified, gFontCacheAgeThreshold)) {
            $.writeln("found current gfontcachelist file");
            gfontString = readFile(gfonts_cachefile);
        } else {
            $.writeln("no current gfontcachelist file found, running curl");
            // download list
            gfontString = gFontScrape();
            // check for valid contents
            if (testGfontDownload(gfontString)) {
                $.writeln("got data, writing file for next time");
                // write out a file for next time (overwrites)
                writeFile(gfonts_cachefile, gfontString);
            } else {
                $.writeln("scrape unsuccessful, using old cache file if avail");
                if (gfonts_cachefile.exists) {
                    gfontDate = gfonts_cachefile.modified;
                    gfontString = readFile(gfonts_cachefile);
                } else {
                    gfontString = "";
                    $.writeln("no cached file, will use hardcoded list");         
                }
            }
        }

        // get list from string, or set list = hardcoded list
        if (gfontString) {
            gfontList = gfontString.split(",");
            // strip whitespace, rm empty entry(s), downcase all entries, add spaceless versions of font names 
            gfontDict = buildFontDict(gfontList);
        } else {
            gfontDict = buildFontDict(gfcListHardCoded);
            gfontDate = gfontStringHardCodedDate;
        }

        if (gfontDate && dateCompare(date, gfontDate, gFontCacheAgeWarningThreshold) === false) {
            alertStr = "Font Usage Report was unable to check google's font list for updates.\nProceeding with cached google font list from " + gfontDate;
            $.writeln("posting alert: '" + alertStr + "'");
            alert(alertStr);
        } else if (gfontDate) {
            $.writeln("gfonts cache used is beyond dl threshold but not yet at warning threshold: " + gFontCacheAgeWarningThreshold);
        }

        return gfontDict;
    }    
}

