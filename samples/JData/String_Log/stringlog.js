jdata {
    char *name as logger;
}

var nlogger = name.getMyDataStream();

setInterval(function() {

	console.log("Size of logger ", name.size());

	if (jsys.type === "cloud")
	    nlogger.log("fred@cloud");
	else if (jsys.type === "fog")
	    nlogger.log("fred@fog");
	else 
	    nlogger.log("fred@device");

	for (i = 0; i < name.size(); i++) {
	    if (name[i] !== undefined) {
		console.log(name[i].lastValue());
		console.log(name[i].key);
	    }
	    else
		console.log("Logger value undefined...");
	}
    }, 1000);
