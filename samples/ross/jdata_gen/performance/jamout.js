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
var wait = require('wait.for-es6');
var JLogger = require('/usr/local/share/jam/lib/jserver/jlogger');
var JManager = require('/usr/local/share/jam/lib/jserver/jmanager');
function* main() {
var x = new JLogger("x", false, JManager);
var jcondition = new Map();
var lastValue = 0;
var latencies = [];
setInterval(function () {
if (x[0] !== undefined && !x[0].isEmpty()) {
var lastData = x[0].lastData();
var lastDataValue = lastData.value.valueOf();
if (lastDataValue !== lastValue) {
var latency = new Date() - lastData.timestamp;
latencies.push(latency);
var valuesRead = latencies.length;
if (valuesRead % 10 === 0) {
console.log('last value: ' + lastDataValue + '; values read: ' + latencies.length + '; avg latency = ' + avg(latencies) + ' ms');
}
lastValue = lastDataValue;
;
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
"functions": {
"avg": avg,
},
"signatures": {
"avg": "s",
}
}
jamlib.registerFuncs(mbox);
jamlib.run(function() { console.log("Running..."); } );
}
wait.launchFiber(main);
