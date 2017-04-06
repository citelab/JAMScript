jdata {
    int x as logger;
}

var lastValue = 0;
var latencies = [];
setInterval(function() {
    if (x[0] !== undefined && !x[0].isEmpty()) {
        var lastData = x[0].lastData();
        var lastDataValue = lastData.value.valueOf();
        if (lastDataValue !== lastValue) {
            var latency = new Date() - lastData.timestamp;
            latencies.push(latency);
            var valuesRead = latencies.length;
            if (valuesRead % 10 === 0) {
                console.log('# values read: ' + latencies.length + '; avg latency = ' + avg(latencies) + ' ms');
            }
            lastValue = lastDataValue;
        }
    }
}, 50);

function avg(arr) {
    var total = 0;
    for (var i = 0; i < arr.length; i++) {
        total += arr[i];
    }
    return Math.round(total / arr.length);
}
