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
var num_calls = 0;
var ping_asyn = function(msg) {
if (msg != "PING") {
console.log("DAMMIT ROBERT ON JAVSCRIPT");
}
num_calls++;

};
var get_num_ping = function() {
return num_calls;

};
var mbox = {
"functions": {
"get_num_ping": get_num_ping,
"ping_asyn": ping_asyn,
},
"signatures": {
"get_num_ping": "callback[1].join('')",
"ping_asyn": "callback[1].join('')",
}
}
jamlib.registerFuncs(mbox);
jamlib.run(function() { console.log("Running..."); } );
