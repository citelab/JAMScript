var jamlib = require('/usr/local/share/jam/lib/jserver/jamlib');
var jnode = require('/usr/local/share/jam/lib/jserver/jnode');
var async = require('asyncawait/async');
var await = require('asyncawait/await');
var http = require('http');
var cbor = require('cbor');
var qs = require('querystring');
var path = require('path');
var mime = require('mime');
var fs = require('fs');

var JAMLogger = require('/usr/local/share/jam/lib/jserver/jamlogger');
var JAMManager = require('/usr/local/share/jam/lib/jserver/jammanager');
var x = new JAMLogger(JAMManager, "x");
var jcondition = new Map();

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

var mbox = {
    "functions": {},
    "signatures": {}
}
jamlib.registerFuncs(mbox);
jamlib.run(function() {
    console.log("Running...");
});
