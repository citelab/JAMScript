var jserver = require('jamserver')(true);
var JAMLogger = jserver.JAMLogger;
var JAMManager = jserver.JAMManager;
var jamlib = jserver.jamlib;
var jnode = jserver.jnode;
var Flow = jserver.Flow;
var InFlow = jserver.InFlow;
var OutFlow = jserver.OutFlow;
var http = require('http');
var cbor = require('cbor');
var qs = require('querystring');
var path = require('path');
var mime = require('mime');
var fs = require('fs');
var jcondition = new Map();
var s = new JAMLogger(JAMManager, "s");
var flow;
setTimeout(function () {
	if (s[0] !== undefined && !s[0].isEmpty()) {
		flow = Flow.from(s[0]);
		flow.setTerminalFunction(function(data){
    		console.log(data);
		});
	}
}, 1000);
console.log(Flow.from(s).select(function(input){
	return "received";
}).collect(Flow.toArray()));
var mbox = {
"functions": {
},
"signatures": {
}
}
jamlib.registerFuncs(mbox);
jamlib.run(function() { console.log("Running..."); } );
