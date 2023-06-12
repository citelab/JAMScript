
jdata {
    char *y as broadcaster;
}

jcond {
    fogonly: jsys.type == "fog";
    devonly: jsys.type == "device";
}

var count =10;


jasync function sendbcast() {
    console.log("Sending broadcast....", count++);
    var msg = "hello..from.." + jsys.type + "--" + count
    console.log(msg);
    y.broadcast(msg);
}


setInterval(function() {
    console.log("Calling sendbcast...");
    sendbcast();
}, 5);

