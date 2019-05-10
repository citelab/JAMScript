var jamlib = require('./jamlib');
var jnode = require('./jnode');
var jsys = require('./jamsys');

module.exports = function(hasRedis) {
	var module = {
		jamlib: jamlib,
		jnode: jnode,
        jsys: jsys
	};
	module.Registrar = require('jdiscovery');
	if(hasRedis) {
		module.JAMLogger = require('./jamlogger');
		module.JAMManager = require('./jammanager');
		module.JAMBroadcaster = require('./jambroadcaster');
		module.JAMShuffler = require('./jamshuffler');
	}
	return module;
};
