const JAMIopad = require("./jamiopad.js"),
	  JAMLogger = require("./jamlogger.js"),
	  JAMManager = require("./jammanager.js");

// initialize datasources
var logger1 = new JAMLogger(JAMManager, "logger1", "fog"),
	logger2 = new JAMLogger(JAMManager, "logger2", "fog"),
	iopad   = new JAMIopad(JAMManager, "iopad");

var stream1 = logger1.addDatastream("devA"),
	stream2 = logger1.addDatastream("devB"),
	stream3 = logger2.addDatastream("devC"),
	stream4 = logger2.addDatastream("devE");

stream1.set_refresh_rate(1000);
stream2.set_refresh_rate(1000);
stream3.set_refresh_rate(1000);
stream4.set_refresh_rate(1000);

// add datasources to the iopad
iopad.subscribe(logger1, function(res){
	//console.log("To logger1",res.new_data);
});

iopad.subscribe(logger2, function(res){
	console.log("To logger2",res.new_data);
});

var i = 0;
function add(){
	stream1.log('App1:A'+i);
	stream2.log('App1:B'+i);
	stream3.log('App1:C'+i);
	stream4.log('App1:D'+i);
	i++;
	setTimeout(add, 2000);
}
add();

