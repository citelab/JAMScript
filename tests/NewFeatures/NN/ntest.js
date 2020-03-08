jdata {
    int x as broadcaster;
    int q as logger;
}

var count = 10;

if (jsys.type == "fog") {
    x.addHook(function(z) {
	console.log("Value ", z);
    });
}


setInterval(function() {

    if (jsys.type == "cloud") {
	x.broadcast(count++);
    }

}, 6000);

