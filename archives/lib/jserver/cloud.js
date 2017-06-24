const JAMLogger = require("./jamlogger.js"),
	  JAMManager = require("./jammanager.js");

// // initialize datasources
var logger = new JAMLogger(JAMManager, "logger1", "cloud");
// add datastreams to logger1 and logger2
logger.addDatastream("devA");

logger[0].setKey({
	app: "play",
	namespace: "global",
	datasource: "logger1",
	datastream: "streamx"
});

console.log(logger[0].key);

logger[0].subscribe(function(key, data){
	console.log(data);
});