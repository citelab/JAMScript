// for this testing script to work, 
// add "return this[this.num_datastreams-1];" 
// to the last line of addDatastream(dev_id) in jamdatastream.js 

const JAMIopad = require("./jamiopad.js"),
	  JAMLogger = require("./jamlogger.js"),
	  JAMManager = require("./jammanager.js");

// initialize datasources
var logger1 = new JAMLogger(JAMManager, "logger1", "fog"),
	logger2 = new JAMLogger(JAMManager, "logger2", "fog"),
	iopad   = new JAMIopad(JAMManager, "iopad");

// add datastreams to logger1 and logger2
logger1.addDatastream("devA"),
logger1.addDatastream("devB"),
logger2.addDatastream("devC"),
logger2.addDatastream("devE");

// add datasources to the iopad
iopad.subscribe(logger1);
iopad.subscribe(logger2);

// log data to each streams in logger1 and logger2 for every 10 ms
var i = 0;
function add(){
	console.log("i:",i);
	for(var j=0;j<logger1.num_datastreams;j=j+2){
		logger1[j].log('App1:A'+i);
		logger1[j+1].log('App1:B'+i);
	}
	for(var j=0;j<logger2.num_datastreams;j=j+2){
		logger1[j].log('App1:C'+i);
		logger1[j+1].log('App1:D'+i);
	}
	i++;
	setTimeout(add, 1000);
}
add();

