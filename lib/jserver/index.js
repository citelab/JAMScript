var jamlib = require('./jamlib');
var jnode = require('./jnode');
var flow = require('flows.js');
var jregistrar = require('jdiscovery');

module.exports = function(hasRedis) {
	var module = {
		jamlib: jamlib,
		jnode: jnode,
		Flow: flow.Flow,
		InFlow: flow.InFlow,
		OutFlow: flow.OutFlow
	};
	module.Registrar = jregistrar;
    
	if(hasRedis) {
		module.JAMLogger = require('./jamlogger');
		module.JAMManager = require('./jammanager');
	}
	return module;
};
