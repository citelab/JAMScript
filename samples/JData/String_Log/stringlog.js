jdata {
    char *name as logger;
}

setInterval(function() {

	console.log("Size of logger ", name.size());

	for (i = 0; i < name.size(); i++) {
	    if (name[i] !== undefined)
		console.log(name[i].lastValue());
	    else
		console.log("Logger value undefined...");
	}
    }, 1000);
