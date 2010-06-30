(function () {
  var prefBranch = Components.classes["@mozilla.org/preferences-service;1"].
								 getService(Components.interfaces.nsIPrefService).
								 getBranch("extensions.itchanged.");

  const extensionID = "itchanged@itchanged.org";
  
  function startup()
  {
    window.removeEventListener("load", startup, false);
	var xhr = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Components.interfaces.nsIXMLHttpRequest);

    var server = prefBranch.getCharPref("server");
	var username;

	if (prefBranch.prefHasUserValue("username")) {
	  username = prefBranch.getCharPref("username");
	}
	var password;
	if (prefBranch.prefHasUserValue("password")) {
	  password = prefBranch.getCharPref("password");
	}
	
  
	xhr.open("GET", "http://" + server + "/api/story", true, username, password);
	xhr.onload = function() {
	  var stories = JSON.parse(this.responseText);
	  var label;
	  var window = document.getElementById("itchanged-debug")
	  for (let i=0; i < stories.length; i++) {
		label = document.createElement("label");
		label.setAttribute("value", stories[i].url);
		window.appendChild(label);
	  }
	}
	xhr.send(null);
  }

  function shutdown()
  {
    window.removeEventListener("unload", shutdown, false);
  }

  window.addEventListener("load", startup, false);
  window.addEventListener("unload", shutdown, false);

  Components.utils.import("resource://itchanged/itchanged.jsm");
})();

