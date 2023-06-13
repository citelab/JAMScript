
jcond {
    fogonly: jsys.type == "fog";
}

var count = 10;

jasync {fogonly} function cool() {
    console.log("Hi, I am cool.. ", count++);
}


setInterval(()=> {
    if (jsys.type === "device")
	cool();
}, 300);


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
