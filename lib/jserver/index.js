var jamlib = require('./jamlib');
var jnode = require('./jnode');
 

module.exports = function(hasRedis) {
	var module = {
		jamlib: jamlib,
		jnode: jnode,
	};
	if(hasRedis) {
		module.JAMLogger = require('./jamlogger');
		module.JAMManager = require('./jammanager');
	}
	return module;
};