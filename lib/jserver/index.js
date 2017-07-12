var jamlib = require('./jamlib');
var jnode = require('./jnode');
var jregistrar = require('jdiscovery');

module.exports = function(hasRedis) {
	var module = {
		jamlib: jamlib,
		jnode: jnode,
	};
	module.Registrar = jregistrar;

	if(hasRedis) {
		module.JAMLogger = require('./jamlogger');
		module.JAMManager = require('./jammanager');
	}
	return module;
};
