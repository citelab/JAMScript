jdata {
    char *name as logger;
}

setInterval(function() {
	
	if (name[0] !== undefined)
	    console.log(name[0].lastValue());
	else
	    console.log("Logger value undefined...");
    }, 1000);
