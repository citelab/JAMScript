var jamlib = require('/usr/local/share/jam/lib/jserver/jamlib');
var jnode = require('/usr/local/share/jam/lib/jserver/jnode');
var JLogger = require('/usr/local/share/jam/lib/jserver/jlogger');
var JManager = require('/usr/local/share/jam/lib/jserver/jmanager');
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
function testy(cb) {jnode.remoteAsyncExec("testy", [cb], "true");}
var mbox = {
"functions": {
"firstcall": firstcall,
},
"signatures": {
"firstcall": "s",
}
}
jamlib.registerFuncs(mbox);
jamlib.run(function() { console.log("Running..."); } );
