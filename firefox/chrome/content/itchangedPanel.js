Components.utils.import("resource://itchanged/itchanged.jsm");

function load() {
//  var tbbutton = window.top.document.getElementById("itchanged-toolbar-button");
//  tbbutton.removeAttribute("unread");
}

function searchKeyword(value)
{
  var like = document.getElementById("like");
  like.textContent = "%" + (value ? value + "%" : "");

  document.getElementById("itchanged-listbox").builder.rebuild();
}

function rowSelected(event){
  if (event.button != 0) {
	return;
  }
  var selectedItem = document.getElementById("itchanged-listbox").selectedItem;
  if (!selectedItem) {
	return;
  }
  var url = selectedItem.getAttribute("url");
        var browsers = window.top.getBrowser().browsers;
        for (var i = 0; i < browsers.length; ++i) {
          var uri = browsers[i].webNavigation.currentURI;
          if (uri.spec == url) {
			var tabs = window.top.getBrowser().mTabs;
			for (var j=0; j < tabs.length; j++) {
			  if (tabs[j].linkedBrowser == browsers[i]) {
				window.top.getBrowser().selectedTab = tabs[j];
			  }
			}
            return;
          }
        }

  window.top.getBrowser().selectedTab = window.top.getBrowser().addTab(url);
}

function deleteArticle() {
  var selectedItem = document.getElementById("itchanged-listbox").selectedItem;
  itchanged.deleteArticleFromDB(selectedItem.getAttribute("value"), selectedItem.getAttribute("url"), selectedItem.getAttribute("updated"));
}

function deleteAll() {
  var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
                                 getService(Components.interfaces.nsIPromptService);
  var sure = promptService.confirm(window, "itchanged", "Are you sure you want to delete all your news stories?");
  if (!sure) {
        return;
  }

  itchanged.deleteAllFromDB();
}

function summarizeArticle() {
  var selectedItem = document.getElementById("itchanged-listbox").selectedItem;
  var url = selectedItem.getAttribute("url");
  var prefBranch = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.itchanged.");


  var server = prefBranch.getCharPref("server");

  window.top.getBrowser().selectedTab = window.top.getBrowser().addTab("http://" + server + "/changes?url=" + encodeURIComponent(url));
}
