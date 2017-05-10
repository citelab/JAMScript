jdata {
    float cpuLog as logger;
    int overloadedBroadcast as broadcaster;
}

var interval = setInterval(function() {
    if (cpuLog[0] !== undefined && !cpuLog[0].isEmpty()) {
        if(cpuLog[0].lastValue() > 1.0) {
            overloadedBroadcast = 1;
            clearInterval(interval);
        }
    }
}, 1000);