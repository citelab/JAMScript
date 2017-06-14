var jserver = require('jamserver')(true);
var JAMLogger = jserver.JAMLogger;
var JAMManager = jserver.JAMManager;
var jamlib = jserver.jamlib;
var jnode = jserver.jnode;
var http = require('http');
var cbor = require('cbor');
var qs = require('querystring');
var path = require('path');
var mime = require('mime');
var fs = require('fs');
var cpuLog = new JAMLogger(JAMManager, "cpuLog");
var jcondition = new Map();
var interval = setInterval(function () {
	if (cpuLog[0] !== undefined && !cpuLog[0].isEmpty()) {
		if (cpuLog[0].lastValue() > 1.0) {
			JAMManager.broadcastMessage("overloadedBroadcast", String(Number(1)));
			clearInterval(interval);
		}
	}
}, 1000);
var mbox = {
	"functions": {},
	"signatures": {}
};
jamlib.registerFuncs(mbox);
jamlib.run(function() { console.log("Running..."); } );
