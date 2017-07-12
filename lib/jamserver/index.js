var jamlib = require('./jamlib');
var jnode = require('./jnode');

module.exports = function(hasRedis) {
	var module = {
		jamlib: jamlib,
		jnode: jnode,
	};
	module.Registrar = require('jdiscovery');
	if(hasRedis) {
		module.JAMLogger = require('./jamlogger');
		module.JAMManager = require('./jammanager');
		module.JAMBroadcaster = require('./jambroadcaster');
	}
	return module;
};
