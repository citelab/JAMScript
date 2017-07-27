jdata {
    int y as broadcaster;
}

setInterval(function() {
    y.broadcast(Math.floor((Math.random() * 100) + 1));
 }, 1000);
