jdata {
    int y as broadcaster;
}

var count = 10;

setInterval(function() {
   console.log("Sending broadcast....", count);
   y.broadcast(count++);
}, 500);

