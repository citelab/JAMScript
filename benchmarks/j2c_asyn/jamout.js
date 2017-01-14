var jlib = require('/usr/local/share/jam/lib/jserver/jamlib');
var jnode = require('/usr/local/share/jam/lib/jserver/jnode');
var async = require('asyncawait/async');
var await = require('asyncawait/await');
var http = require('http');
var cbor = require('cbor');
var qs = require('querystring');
var path = require('path');
var mime = require('mime');
var fs = require('fs');
var jcondition = new Map();
var iterations = 100;
for (var i = 0; i < iterations; i++) {
ping_async("PING", 100);
}
var get_rcv_count = function() {
if (num != iterations) {
console.log("DAMMIT ROBERT ON JAVSCRIPT");
}

};
function ping_async(msg,iterations) {jnode.remoteAsyncExec("ping_async", [msg,iterations], "true");}
var mbox = {
"functions": {
"get_rcv_count": get_rcv_count,
},
"signatures": {
"get_rcv_count": "callback[1].join('')",
}
}
jamlib.registerFuncs(mbox);
jamlib.run(function() { console.log("Running..."); } );
