jdata {
    int y as broadcaster;
}

var count = 10;

setInterval(function() {
	y.broadcast(count++);
    }, 500);

setInterval(function() {
	console.log(y.getClock());
    }, 2000);
