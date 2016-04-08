// Servlet Manager
// Create servlet manager that creates and destroys servlets
// We should be able to give an appid at creation and deletion

// A servlet when it is created is installed with the required set
// of commands... abbreviated function names..
// We cannot install commands into the servlets directly. This is a security
// and authorization issue..

module.exports = {

	createservlet: function(appid, cmdarr, callback) {
		// initialize the servlet with the given command object..
		var svlet = new this.Servlet({server: this.host, port: 0}, cmdarr);
		var self = this;
		console.log("Servlet " + svlet.host);
		if (svlet !== undefined) {
			// the servlet is already running if it is successfully created..
			svlet.run(function(addr) {
				self.servlets[appid] = svlet;
				callback({server: addr.address, port: addr.port});
			});
		} else
			callback(undefined);
	},

	recreateservlet: function(appid, servinfo, cmdarr, callback) {
		var svlet = this.servlets[appid];
		if (svlet !== undefined) {
			// if old servlet is still running.. stop it.
			svlet.stopservlet();
			delete(this.servlets[appid]);
		}
		svlet = new this.Servlet(servinfo, cmdarr);
		this.servlets[appid] = svlet;
		if (svlet !== undefined) {
			svlet.run(function(addr) {
				callback({server: addr.address, port: addr.port});
			});
		}
		else
			callback(undefined);
	},

	destroyservlet: function(appid, callback) {

		// find the servlet corresponding to the appid
		var svlet = this.servlets[appid];
		if (svlet !== undefined) {
			// stop the servlet..
			svlet.stopservlet();

			// delete the element.
			delete(this.servlets[appid]);
			callback(appid);
		} else
		    callback(undefined);
	},

	init: function(host) {
		// load servlet Constructor function
		this.Servlet = require('./servlet.js');

		// save the host identity...
		this.host = host;

		// we need to save the currently active servlets... this will be empty
		// at server startup.. this is useful for killing 'zombie' servlets..
		this.servlets = [];
		return this;
	}
}
