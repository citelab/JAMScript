jdata {
    int y as broadcaster;
}

var count = 10;

jcond{
    fogonly: sys.type == "fog";
    cloudonly: sys.type == "cloud";
}

// jasync {fogonly || cloudonly} function bcast(){
//     y.broadcast(count++);
// }

function bcast(){
    if( !JAMManager.isDevice )
        y.broadcast(count++);
}

setInterval(function() {
    bcast();
}, 500);

setInterval(function() {
    var clock = y.getClock();
	console.log(clock, ' = ', y.getMessageAtClock(clock));
}, 500);
