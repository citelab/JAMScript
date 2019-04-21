jdata {
    char *log_buffer as logger;
}

var nlogger = log_buffer.getMyDataStream();
var count = 1;

setInterval(function() {
	if (jsys.type === "cloud")
	    nlogger.log("pi@cloud-" + count);
	else if (jsys.type === "fog")
	    nlogger.log("pi@fog-" + count);
	else
	    nlogger.log("pi@device-" + count);

	for (i = 0; i < log_buffer.size(); i++) {
	    if (log_buffer[i] !== undefined) {
		console.log("I: ", i, " LOG: ", log_buffer[i].lastValue());
	    }
	    else {
            console.log("Logger value undefined...");
        }
	}

	count = count + 1;
}, 1000);
