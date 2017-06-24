var jamlib = require('./jamlib');
var jnode = require('./jnode');
var flow = require('./flow');

module.exports = function(hasRedis) {
	var module = {
		jamlib: jamlib,
		jnode: jnode,
		Flow: flow.Flow,
		InFlow: flow.InFlow,
		OutFlow: flow.OutFlow
	};
	module.Registrar = require('./jdiscovery/jregistrar');
	if(hasRedis) {
		module.JAMLogger = require('./jamlogger');
		module.JAMManager = require('./jammanager');
	}
	return module;
};
