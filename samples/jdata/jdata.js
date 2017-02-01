jdata {
    int x as logger;
    int y as broadcaster;
}

setInterval(function() {
    console.log(x);
    if(x.get_newest_value !== undefined) {
        if(Number(x.get_newest_value.log) > 1.0) {
            y = 4;
        }
    }
}, 1000);