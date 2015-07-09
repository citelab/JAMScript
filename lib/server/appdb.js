
// Database module.. it initializes the NeDB database and exports the
// module itself.

module.exports = ({

	isregistered: function(appname, callback) {
		// if the appname is uniquely found in the database then return appid,
		// otherwise return 0 - indicating 'notregistered'
		this.db.find({appname: appname}, function(err, docs) {
			if (docs.length === 1)
				callback(docs[0].appid);
			else
				callback(0);
		});
	},

	// start the 'service' to support the app, get an appid..
	// insert app into the database.. including the details of the service (server, port)
	register: function(appname, callback) {
		// get appid
		var that = this;
		this.db.find({maxappid: {$exists: true}}, function(err, docs) {
			if (docs.length === 1) {
				var appid = docs[0].maxappid;
				// save the next value for appid..
				that.db.update({maxappid: appid}, {maxappid: (appid + 1)}, function(err, numReplaced) {
					// numReplaced === 1 here...
					if (numReplaced === 1) {
						callback(appid);
					}
				});
			} else {
				callback(undefined);
			}

		});
	},

	finalizeregister: function(dentry) {
		this.db.insert(dentry, function(err, docs) {
			// we are not checking this insertion... assuming to go through..
		});
	},

	// remove the 'service' attached with the app
	// change the 'state' variable
	closeapp: function(appid, callback) {
		this.db.find({appid: appid}, function(err, docs) {
			if (docs.length === 1)
				callback(appid);
			else
				callback(undefined);
		});
	},

	finalizeclose: function(appid) {
		this.db.update({appid: appid}, {$set: {state: 0}}, function(err, numReplaced) {
			// numReplaced === 1 here...
			// TODO: Fix this empty block
		});
	},

	// if app with the given appid is closed, then open it
	// start the 'service'
	// change the 'state' variable in the db
	openapp: function(appname, callback) {
		this.db.find({appname: appname}, function(err, docs) {

			if (docs.length === 1) {
				var appid = docs[0].appid;
				// open the app using the callback
				callback({appid: appid, address: docs[0].server, port: docs[0].port});
			} else {
				callback(undefined);
			}
		});
	},

	finalizeopen: function(appid) {
		// update the status..
		this.db.update({appid: appid}, {$set: {state: 1}}, function(err, numReplaced) {
			// numReplaced === 1 here... not checking the update .. assumed to go through
		});
	},

	removeapp: function(appid, callback) {
		this.db.remove({appid: appid}, function(err, docs) {
			if (docs.length === 1) {
				callback(appid);
			} else {
				callback(0);
			}
		});
	},



	// return the appinfo as a hashtable in JSON object..
	getappinfo: function(appid, callback) {
		this.db.find({appid: appid}, function(err, docs) {
			if (docs.length === 1) {
				callback(docs[0]);
			} else {
				callback(undefined);
			}
		});
	},

	init: function() {
		var Datastore = require('nedb'),
		    db = new Datastore({filename: 'app.db', autoload:true});
		this.db = db;
		this.db.ensureIndex({fieldName:'appid', unique:true}, function(err) {
			console.log("Unique index violation - duplicate appid found");
		});

		// start appid at 100.. we are counting upwards
		this.db.insert({maxappid: 99}, function(err, docs) {
		});

		// allow init call only once.. returns undefined next time!
		this["init"] = undefined
		return this;
	}
}).init();
