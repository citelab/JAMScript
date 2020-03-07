jdata {
    int x as broadcaster;
}

var count = 10;

setInterval(function () {

    if (jsys.type == "cloud")
	x.broadcast(count++);
    else
	x.addHook(function(z) {
	    console.log("Value broadcasted ", z);
	});
}, 200);
