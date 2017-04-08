jdata {
    int y as broadcaster;
}

setInterval(function() {
    y = Math.floor((Math.random() * 100) + 1);
}, 1000);
