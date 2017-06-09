const JAMLogger = require("../../lib/jserver/jamlogger.js"),
	  JAMManager = require("../../lib/jserver/jammanager.js"),
	  flow = require("../../lib/jserver/flow.js");

// initialize a datasource
var logger1 = new JAMLogger(JAMManager, "logger1", "fog");
var logger2 = new JAMLogger(JAMManager, "logger2", "fog");

// add a datastreams to logger1 and logger2
logger1.addDatastream("devA");
logger1.addDatastream("devB");
logger2.addDatastream("devC");

// at the current stage, only JSON object, string, and number can be logged into datastreams
// datastreams on the same datasource can only holds data of the same type

// log data of type number (1,2,3,4,5) to devA datastream in logger1
var value=1;
function log_to_logger1(){
	if(value>20) return;
	logger1[0].log(value, function(res){
		if(!res.status) console.log(res.error);
		else console.log(logger1[0].key,": Last value:\n",logger1[0].lastValue());
	});
	value++;
	setTimeout(log_to_logger1, 100);
}
log_to_logger1();

// log data of type other than number ("abcd") to datastreans in logger1
logger1[1].log("abcd", function(res){
	if(!res.status) console.log(res.error);
	else console.log(logger1[0].key,": all values:\n",logger1[0].values());
});

// log data of type object to devC datastream in logger2
var obj = {
	name: "apple",
	color: "blue" 
}, i=0;
function log_to_logger2(){
	if(i>20) return;
	logger2[0].log(obj, function(res){
		if(!res.status) console.log(res.error);
		else console.log(logger2[0].key,": Last data:\n",logger2[0].lastData());
	}); 
	i++;
	setTimeout(log_to_logger2, 100);
}
log_to_logger2();