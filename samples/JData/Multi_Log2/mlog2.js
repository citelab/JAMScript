jdata {
    char *name as logger;
}

var count = 1;

setInterval(function() {

	for (i = 0; i < name.size(); i++) {

	    if (name[i] !== undefined) {
		console.log("name[" + i + "] = ", name[i].lastValue(), "deviceID = ", name[i].getDeviceId());
	    }
	    else
		console.log("Logger value undefined...");
	}
	
    }, 1000);

var namelogger = name.getMyDataStream();

setInterval(function() {

	namelogger.log("Count = " + count++ + " @J, level = " + namelogger.getLevel(), function(results) {
		if (!results.status)
		    console.log(results.error);
	    });
    }, 1000);
