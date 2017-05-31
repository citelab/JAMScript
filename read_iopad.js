const JAMIopad = require("./jamiopad.js"),
	  JAMLogger = require("./jamlogger.js"),
	  JAMManager = require("./jammanager.js");

// initialize datasources
var logger3 = new JAMLogger(JAMManager, "logger3", "cloud"),
	logger4 = new JAMLogger(JAMManager, "logger4", "dev"),
	iopad   = new JAMIopad(JAMManager, "iopad");

var stream1 = logger3.addDatastream("devA"),
	stream2 = logger3.addDatastream("devB"),
	stream3 = logger4.addDatastream("devC"),
	stream4 = logger4.addDatastream("devD");

iopad.subscribe(logger3, function(res){
	console.log("To logger3",res.new_data);
});

iopad.subscribe(logger4, function(res){
	console.log("To logger4",res.new_data);
});

stream1.set_refresh_rate(1500);
stream2.set_refresh_rate(1500);
stream3.set_refresh_rate(1500);
stream4.set_refresh_rate(1500);

var i = 0;
function add(){
	stream1.log('App2:A'+i);
	stream2.log('App2:B'+i);
	stream3.log('App2:C'+i);
	stream4.log('App2:D'+i);
	i++;
	setTimeout(add, 2000);
}
add();
