
jdata {
    char *y as broadcaster;
}

var count =10;


jasync function sendbcast() {
   console.log("Sending broadcast....", count++);
   var msg = "hello..you..have..msg-" + count
   y.broadcast(msg);
}


setInterval(function() {
    console.log("Calling sendbcast...");
	sendbcast();
}, 500);

