
jdata {
    char *name as logger;
}

var nlogger = name.getMyDataStream();
var count = 1;

setInterval(function() {

    if (jsys.type === "cloud")
	nlogger.log("fred@cloud-" + count);
    else if (jsys.type === "fog")
	nlogger.log("fred@fog-" + count);
    else
	nlogger.log("fred@device-" + count);

    for (i = 0; i < name.size(); i++) {
	if (name[i] !== undefined) 
	    console.log("I: ", i, " Name ", name[i].lastValue());
	else
	    console.log("Logger value undefined...");
    }

    count = count + 1;
}, 1000);


// change position with time.
// Move on a line from one end to the other end.

var xCoord = 10;
var yCoord = 0;
var maxX = 150;

if (jsys.type == "device") {
    jsys.setLat(xCoord);
    jsys.setLong(yCoord);

    setInterval(function() {
        xCoord += 5;
        if (xCoord > maxX)
            xCoord = 10;
        jsys.setLat(xCoord);
    }, 300);
}
