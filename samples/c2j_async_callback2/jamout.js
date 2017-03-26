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
var jcondition = new Map();
function callb(abc) {
console.log(abc);
}
function firstcall(str) {
console.log(str);
testy(callb);

}
function testy(cb) {
if(typeof cb === "function") { cb = cb.name; }
jnode.remoteAsyncExec("testy", [ cb ], "true", 0);
}
var mbox = {
"functions": {
"callb": callb,
"firstcall": firstcall,
},
"signatures": {
"callb": "s",
"firstcall": "s",
}
}
jamlib.registerFuncs(mbox);
jamlib.run(function() { console.log("Running..."); } );
