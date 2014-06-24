
// Database module.. it initializes the NeDB database and exports the
// module itself. 

module.exports = ({
	isregistered: function(appname) {

	},

	register: function() {

	},

	closeapp: function(appid) {

	},

	openapp: function(appid) {

	},

	updateappinfo: function(appid, valobj) {

	},

	getappinfo: function(appid) {


	},

	init: function() {
		var Datastore = require('nedb'),
		    db = new Datastore({filename: 'app.db', autoload:true});
		this.db = db;

		// allow init call only once.. returns undefined next time!
		this["init"] = undefined
		return this;
	}
}).init();


