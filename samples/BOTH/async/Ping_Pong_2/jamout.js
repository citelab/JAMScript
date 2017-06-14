var jamlib = require('/usr/local/share/jam/lib/jserver/jamlib');
var jnode = require('/usr/local/share/jam/lib/jserver/jnode');
var http = require('http');
var cbor = require('cbor');
var qs = require('querystring');
var path = require('path');
var mime = require('mime');
var fs = require('fs');
var deasync = require('deasync');
var jcondition = new Map();
var count = 0;
function pingserver(penum) {
if(typeof penum === "function") { penum = penum.name; }
jnode.machAsyncExec("pingserver", [ penum ], "true", 0);
}
function regme(msg,cback) {
if(typeof msg === "function") { msg = msg.name; }
if(typeof cback === "function") { cback = cback.name; }
jnode.machAsyncExec("regme", [ msg,cback ], "true", 0);
}
function callpingserver(penum) {
console.log("Ping received from ", penum);

}
function callregme(msg,_1) {
cback = function(x) { jnode.remoteAsyncExec(_1, [x], "true", 0); }
count = count + 1;
;
console.log("registration received from ", msg);
cback('' + count);

}
var mbox = {
"functions": {
"pingserver": callpingserver,
"regme": callregme,
},
"signatures": {
"pingserver": "n",
"regme": "ss",
}
}
jamlib.registerFuncs(mbox);
jamlib.run(function() { console.log("Running..."); } );
