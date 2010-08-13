var EXPORTED_SYMBOLS = ["itchanged"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

const prefBranch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("extensions.itchanged.");
const observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
const consoleService = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
const storageService = Cc["@mozilla.org/storage/service;1"].getService(Ci.mozIStorageService);
const privateBrowsingService = Cc["@mozilla.org/privatebrowsing;1"].getService(Ci.nsIPrivateBrowsingService);

var username;
var password;

var dbConnection = null;

var unreadCount = 0;

function notifyObservers() {
  var subject = {};
  var unreadObj = {};
  unreadObj.count = unreadCount;
  subject.wrappedJSObject = unreadObj;
  observerService.notifyObservers(subject, "itchanged", "update");
}

var timerCallback  = {      
  notify: function notify(timer) {
	var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
	xhr.mozBackgroundRequest = true;

    var server = prefBranch.getCharPref("server");
	
	xhr.open("GET", "http://" + server + "/api/story?updated=true", true, username, password);
	xhr.onload = function() {
	  var stories = JSON.parse(this.responseText);
	  unreadCount = stories.length;
	  for (let i=0; i < stories.length; i++) {
          var sql = "UPDATE articles SET updated = 1";
          sql += " WHERE url = '" + stories[i].url + "'";
          var statement = dbConnection.createStatement(sql);
          statement.executeAsync(dbListener);		  
	  }
	}
	xhr.send(null);
  }
}

var updateTimer = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer);
//updateTimer.initWithCallback(timerCallback, 15*30*1000, Ci.nsITimer.TYPE_REPEATING_SLACK);
updateTimer.initWithCallback(timerCallback, 30*1000, Ci.nsITimer.TYPE_REPEATING_SLACK);

var dbListener = {
  handleResult: function(aResultSet) {
	
  },
  handleError: function(aError) {
  },
  handleCompletion: function(aReason) {
	notifyObservers();
  }
}

var dbListener2 = {
  handleResult: function(aResultSet) {
    for (let row = aResultSet.getNextRow(); row; row = aResultSet.getNextRow()) {
      unreadCount = row.getResultByIndex(0);
    }
  },
  handleError: function(aError) {
  },
  handleCompletion: function(aReason) {
	notifyObservers();
  }
}


var itchanged = {
  database: null,
  log: function(string) {
    consoleService.logStringMessage(string);
  },
  initializeDB: function() {
	if (!this.database) {
      this.database = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties)
								                               .get("ProfD", Ci.nsIFile);
	  this.database.append("itchanged.sqlite");

	  dbConnection = storageService.openDatabase(this.database);

      /* version number for schema changes */
      schemaVersion = 0;
      if (!dbConnection.tableExists("schema")) {
		dbConnection.executeSimpleSQL( 'CREATE TABLE schema(version)' );
        if( dbConnection.tableExists("articles") ) {
          ++schemaVersion;  /* first version of schema had no version */
        }
	    dbConnection.executeSimpleSQL( 'INSERT INTO schema(version) VALUES (' + schemaVersion + ')' );
      } else {
        /* check current version */
        stmt = dbConnection.createStatement( 'SELECT version FROM schema LIMIT 1' );
        stmt.executeStep();
        schemaVersion = parseInt( stmt.row.version );
      }

      if( schemaVersion==0 ) {
        /* blank slate */
		dbConnection.executeSimpleSQL('CREATE TABLE articles ("id" INTEGER PRIMARY KEY NOT NULL' +
								', "title" TEXT NOT NULL' +
								', "url" TEXT' +
								', "client_hash" TEXT' +
								', "server_hash" TEXT' +
								', "updated" BOOLEAN DEFAULT 0' +
                                ', "pubdate" TEXT' +
                                ', "publication" TEXT' +
                                ', "kind" TEXT' +
								' )');
        schemaVersion = 2;
	    dbConnection.executeSimpleSQL( 'UPDATE schema SET version=' + schemaVersion );
	  }

      if( schemaVersion==1 ) {
        dbConnection.executeSimpleSQL( 'ALTER TABLE articles ADD COLUMN "pubdate" TEXT' );
        dbConnection.executeSimpleSQL( 'ALTER TABLE articles ADD COLUMN "publication" TEXT' );
        dbConnection.executeSimpleSQL( 'ALTER TABLE articles ADD COLUMN "kind" TEXT' );
        schemaVersion = 2;
	    dbConnection.executeSimpleSQL( 'UPDATE schema SET version=' + schemaVersion );
      }

	}
  },

  deleteArticleFromDB: function(id, url, updated) {
	if (!dbConnection) {
	  this.initializeDB();
	}
	var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
	xhr.mozBackgroundRequest = true;

    var server = prefBranch.getCharPref("server");
	
	xhr.open("DELETE", "http://" + server + "/api/story" + "?url=" +  encodeURIComponent(url), true, username, password);
	xhr.send(null);

	var sql = "DELETE FROM articles WHERE id = " + id + ";";
	dbConnection.executeSimpleSQL(sql);
	if (updated == "1") {
	  unreadCount--;
	}
	notifyObservers();
  },

  deleteAllFromDB: function() {
	if (!dbConnection) {
	  this.initializeDB();
	}
	var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
	xhr.mozBackgroundRequest = true;

    var server = prefBranch.getCharPref("server");
	
	xhr.open("DELETE", "http://" + server + "/api/story", true, username, password);
	xhr.send(null);

	var sql = "DELETE FROM articles;";
	dbConnection.executeSimpleSQL(sql);
	unreadCount = 0;
	notifyObservers();
  },

  articleExistsInDB: function(url) {
	if (!dbConnection) {
	  this.initializeDB();
	}
	var duplicate = false;
	var statement = dbConnection.createStatement("SELECT * FROM articles WHERE url = :url LIMIT 1");
	statement.params.url = url;
	while (statement.executeStep()) {
      duplicate = true;
	  break;
	}
	return duplicate;
  },

  sendArticleToServer: function(uploadArray) {
	var xhr = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Components.interfaces.nsIXMLHttpRequest);
	xhr.mozBackgroundRequest = true;

    var server = prefBranch.getCharPref("server");

	xhr.open("POST", "http://" + server + "/api/story", true, username, password);
	 
	var boundary = '---------------------------';
	boundary += Math.floor(Math.random()*32768);
	boundary += Math.floor(Math.random()*32768);
	boundary += Math.floor(Math.random()*32768);
	xhr.setRequestHeader("Content-Type", 'multipart/form-data; boundary=' + boundary);
	var body = '';
	body += '--' + boundary + '\r\n' + 'Content-Disposition: form-data; name="';
	body += "data";
	body += '"\r\n\r\n';
	body += JSON.stringify(uploadArray);
	body += '\r\n'
	body += '--' + boundary + '--';
	xhr.setRequestHeader('Content-length', body.length);
	xhr.onload = function() {
	  var result = JSON.parse(this.responseText);
	  for (let i=0; i < result.length; i++) {
		var sql = "UPDATE articles SET server_hash = '" + result[i].comphash + "'";
		sql += " WHERE url = '" + result[i].url + "'";
		dbConnection.executeSimpleSQL(sql);
	  }
	//  if (hash != info.comphash) {
	//	var sql = "UPDATE articles SET server_hash = " + info.comphash;
	//	sql += " WHERE url = '" + url + "'";
	//	dbConnection.executeSimpleSQL(sql);
	//  }

	}
	xhr.send(body);
  },

  insertArticleIntoDB: function(newsArray) {
	/* Don't insert the article if we are in private browsing mode */
	if (privateBrowsingService.privateBrowsingEnabled) {
	  return;
	}

    var uploadArray = [];

    for (var i=0; i < newsArray.length; i++) {
	  var uploadItem = {};
	  /* COMPUTE HASH */
	  var hash = "";
	  if (newsArray[i].hnews["entry-content"]) {
		var entryContent;
		if (newsArray[i].hnews["entry-content"].length > 1) {
		  entryContent = newsArray[i].hnews["entry-content"].join(" ");
		} else {
		  entryContent = newsArray[i].hnews["entry-content"][0];
		}
		hash = this.md5(entryContent);
	  }
	  uploadItem.url = newsArray[i].url;
	  uploadItem.hash = hash;
  

      /* If the article already exists, mark it as read */
	  if (this.articleExistsInDB(newsArray[i].url)) {
		var sql = "UPDATE articles SET updated = 0";
		sql += " WHERE url = '" + newsArray[i].url + "'";
		var statement = dbConnection.createStatement(sql);
		statement.executeAsync(dbListener);
		sql = "SELECT * FROM articles WHERE url = '" + newsArray[i].url + "'";
		var statement2 = dbConnection.createStatement(sql);
		while (statement2.executeStep()) {
		  var row = statement2.row;
		  if (hash == row["client_hash"]) {
			uploadItem.hash = row["server_hash"]
		  }
		  break;
		}
	  } else {  
		var sql = "INSERT INTO articles (title";
		sql += ", url"
		sql += ", client_hash"
		sql += ", pubdate"
		sql += ", publication"
		sql += ", kind"
		sql += ") VALUES (:title";
		sql += ", :url"
		sql += ", :hash"
		sql += ", :pubdate"
		sql += ", :publication"
		sql += ", :kind"
		sql += ")";
	
		var statement = dbConnection.createStatement(sql);
		statement.params['title'] = newsArray[i].hnews["entry-title"];
		statement.params['url'] = newsArray[i].url;
		statement.params['hash'] = hash;
		if( newsArray[i].hnews.published ) {
    	  dt = new Date( newsArray[i].hnews.published );
        } else {
    	  dt = new Date( newsArray[i].hnews.updated );
        }
    	statement.params['pubdate'] = dt.toLocaleDateString();

		if( newsArray[i].hnews['source-org'] ) {
            statement.params['publication'] = newsArray[i].hnews['source-org'].fn;
        } else {
            statement.params['publication'] = '';
        }
		statement.params['kind'] = 'hatom';
		statement.executeAsync(dbListener);
	  }
	  uploadArray.push(uploadItem);
	}

/* Check number of unread */
	sql = "SELECT COUNT(1) FROM articles WHERE updated = 1";
	var statement3 = dbConnection.createStatement(sql);
	statement3.executeAsync(dbListener2);

  	this.sendArticleToServer(uploadArray);

  },

  md5: function(string) {
    var converter = Cc['@mozilla.org/intl/scriptableunicodeconverter']
                              .createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = 'UTF-8';
    var result = {};
    var data = converter.convertToByteArray(string, result);
    var ch = Cc['@mozilla.org/security/hash;1'].createInstance(Ci.nsICryptoHash);
    ch.initWithString("MD5");
    ch.update(data, data.length);
    var hash = ch.finish(false);
    function toHexString(charCode) {
      return ('0' + charCode.toString(16)).slice(-2);
    }
    return [toHexString(hash.charCodeAt(i)) for (i in hash)].join('');
  },

  initUserPass: function() {
	if (prefBranch.prefHasUserValue("username")) {
	  username = prefBranch.getCharPref("username");
	}
	if (prefBranch.prefHasUserValue("password")) {
	  password = prefBranch.getCharPref("password");
	}
	if (username && password) {
	  return true;
	}
  
	var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
	xhr.mozBackgroundRequest = true;

    var server = prefBranch.getCharPref("server");

	xhr.open("GET", "http://" + server + "/api/users", true);
	xhr.onload = function() {
	  var userpass = JSON.parse(this.responseText);
	  username = userpass.username;
	  prefBranch.setCharPref("username", username);
	  password = userpass.password;
	  prefBranch.setCharPref("password", password);
	}
	xhr.send(null);
	return false;
  }
}

if (!dbConnection) {
  itchanged.initializeDB();
}
