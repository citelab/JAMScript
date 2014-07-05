// Servlet Manager
// Create servlet manager that creates and destroys servlets
// We should be able to give an appid at creation and deletion

// A servlet when it is created is installed with the required set
// of commands... abbreviated function names..
// We cannot install commands into the servlets directly. This is a security
// and authorization issue..

module.exports = {

	createservlet: function(appid, cmdobj, callback) {
		// initialize the servlet with the given command object..
		var svlet = new this.Servlet(this.host, cmdobj);
		var self = this;
		console.log("Servlet " + svlet.host);
		if (svlet !== undefined) {
			// the servlet is already running if it is successfully created..
			svlet.run(function(addr) {
				// save the servelet in the table indexed by the appid
				self.servlets[appid] = svlet;
				callback({server: addr.address, port: addr.port});
			});
		} else 
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
		}
		callback(undefined);
	},

	init: function(host) {
		// load servlet Constructor function
		this.Servlet = require('./servlet.js');

		// save the host identity...
		this.host = host;
		this.servlets = [];
		return this;
	}
}