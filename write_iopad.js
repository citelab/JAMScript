const JAMIopad = require("./jamiopad.js"),
	  JAMLogger = require("./jamlogger.js"),
	  JAMManager = require("./jammanager.js");

// initialize datasources
var logger1 = new JAMLogger(JAMManager, "logger1", "fog"),
	logger2 = new JAMLogger(JAMManager, "logger2", "fog"),
	iopad   = new JAMIopad(JAMManager, "iopad");

var stream1 = logger1.addDatastream("devA"),
	stream2 = logger1.addDatastream("devB"),
	stream3 = logger2.addDatastream("devC");

// add datasources to the iopad
iopad.addDatasource(logger1);
iopad.addDatasource(logger2);


/*
for(var i=0;i<10;i++){
	stream1.log('A'+i, undefined);
	stream2.log('B'+i, undefined);
	stream3.log('C'+i, undefined);
}
console.log(stream1, stream3.datastream);
*/

