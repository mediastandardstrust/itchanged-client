/* Timer to rebuild when things are updated */
/* Figure how to indicate when things are updated */

const observerService = Components.classes["@mozilla.org/observer-service;1"]
                                  .getService(Components.interfaces.nsIObserverService);


(function () {

  var IC = {};
  
  var prefBranch = Components.classes["@mozilla.org/preferences-service;1"].
								 getService(Components.interfaces.nsIPrefService).
								 getBranch("extensions.itchanged.");

  const extensionID = "itchanged@itchanged.org";

  var itchangedObserver = {      
	observe: function observe(subject, topic, data) {
	  switch (data) {
		case "update":
		  if (!document.getElementById("sidebar-box").hidden) {
			if (document.getElementById("sidebar-box").getAttribute("src").match("itchangedPanel.xul")) {
			  document.getElementById("sidebar").contentDocument.getElementById("itchanged-listbox").builder.rebuild();
			}
		  }
		  var unreadObj = subject.wrappedJSObject;
		  var tbButton = document.getElementById("itchanged-toolbar-button");
		  if (unreadObj && unreadObj.count > 0) {
		    tbButton.setAttribute("unread", unreadObj.count);
		  } else {
			tbButton.removeAttribute("unread");
		  }
		  break;
	  }
	}
  }
  
  function onPageShow(event) {
	var news = IC.Microformats.get("hNews", event.target);
	var entries = IC.Microformats.get("hAtom-hEntry", event.target);
	var articleArray = [];
	if (news.length > 0) {
	  for (var i=0; i < news.length; i++) {
		if (news[i]["entry-content"]) {
		  var newsArticle = {};
		  newsArticle.hnews = news[i];
		  if (news[i].bookmark) {
			newsArticle.url = news[i].bookmark.link;
		  } else {
			newsArticle.url = event.target.location.href;
		  }
		  articleArray.push(newsArticle);
		}
	  }
	}
	if (entries.length > 0) {
	  for (var i=0; i < entries.length; i++) {
		if (entries[i]["entry-content"] && entries[i]["entry-title"]) {
		  var newsArticle = {};
		  newsArticle.hnews = entries[i];
		  if (entries[i].bookmark) {
			newsArticle.url = entries[i].bookmark.link;
		  } else {
			newsArticle.url = event.target.location.href;
		  }
		  articleArray.push(newsArticle);
		}
	  }
	}
	itchanged.insertArticleIntoDB(articleArray);
  }

  function insertTBButton(buttonID, beforeID) {
	var navBar = document.getElementById("nav-bar");
	var before = document.getElementById(beforeID);
	var newSet;
	if (navBar && before) {
	  var newButton = navBar.insertItem(buttonID, before);
	  if (navBar.hasAttribute("currentset") && 
		  (navBar.getAttribute("currentset").indexOf(buttonID) == -1)) {
		newSet = navBar.getAttribute("currentset");
	  } else {
		newSet = navBar.getAttribute('defaultset');
	  }
	  newSet = newSet.replace("," + beforeID, "," + buttonID + "," + beforeID);
	  navBar.setAttribute('currentset', newSet);
	  document.persist('nav-bar', 'currentset');
	}
	if (!newButton || !navBar || !before) {
	  window.setTimeout(insertTBButton, 500, buttonID, beforeID);
	}
  }

  /* This function handles the window startup piece, initializing the UI and preferences */
  function startup()
  {
    window.removeEventListener("load", startup, false);
	var firstrun = false;
	try {
	  firstrun = prefBranch.getBoolPref("firstrun");
	} catch(ex) {
	  firstrun = true;
	}
	/* get installed version */
    var em = Cc["@mozilla.org/extensions/manager;1"]
                       .getService(Ci.nsIExtensionManager);

    var curVersion = em.getItemForID(extensionID).version;

	if (firstrun) {
	  insertTBButton("itchanged-toolbar-button", "urlbar-container");
      window.setTimeout(function(){
        gBrowser.selectedTab = gBrowser.addTab("http://itchanged.org/success");
      }, 1500); //Firefox 2 fix - or else tab will get closed
	  prefBranch.setBoolPref("firstrun", false);
	  prefBranch.setCharPref("installedVersion", curVersion);
	} else {
	  var installedVersion = prefBranch.getCharPref("installedVersion");
	  if (curVersion > installedVersion) {
      window.setTimeout(function(){
//        gBrowser.selectedTab = gBrowser.addTab("http://kaply.com/hnews/upgrade");
      }, 1500); //Firefox 2 fix - or else tab will get closed
  	    prefBranch.setCharPref("installedVersion", curVersion);
	  }
	}
    /* Event listeners for showing and hiding page content */
    window.document.getElementById("content").addEventListener("DOMContentLoaded", onPageShow, true);

    Components.utils.import("resource://itchanged/Microformats.jsm", IC);

    observerService.addObserver(itchangedObserver, "itchanged", false);
    if (itchanged.initUserPass()) {
	  /* DO FIRST UPDATE */
	}
  }

  function shutdown()
  {
    window.document.getElementById("content").removeEventListener("DOMContentLoaded", onPageShow, true);
    observerService.removeObserver(itchangedObserver, "itchanged", false);
    window.removeEventListener("unload", shutdown, false);
  }

  window.addEventListener("load", startup, false);
  window.addEventListener("unload", shutdown, false);

  Components.utils.import("resource://itchanged/itchanged.jsm");
})();

