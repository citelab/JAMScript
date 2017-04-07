jdata {
    int x as logger;
}

setInterval(function() {
    if (x[0] !== undefined && !x[0].isEmpty()) {
        console.log(x[0].lastValue());
    }
}, 1000);
