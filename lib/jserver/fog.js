const JAMLogger = require("./jamlogger.js"),
	  JAMManager = require("./jammanager.js");

// initialize datasources
var logger = new JAMLogger(JAMManager, "logger1", "cloud");
var parentRedis = JAMManager.connectToParent("10.0.0.1", "6379");
// add datastreams to logger1 and logger2
logger.addDatastream("devA");
logger[0].setKey({
	app: "play",
	namespace: "global",
	datasource: "logger1",
	datastream: "streamx"
});

console.log(logger[0].key);

var i=1;
function add(){
	logger[0].log(i, function(){
		console.log("Fog received data:",i);
	}, parentRedis);
	i++;
}
setInterval(add, 1000);
