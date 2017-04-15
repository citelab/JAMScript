var jamlib = require('/usr/local/share/jam/lib/jserver/jamlib');
var jnode = require('/usr/local/share/jam/lib/jserver/jnode');
var http = require('http');
var cbor = require('cbor');
var qs = require('querystring');
var path = require('path');
var mime = require('mime');
var fs = require('fs');
var wait = require('wait.for-es6');
function* main() {
var jcondition = new Map();
function doubler(b,complete) {
if(typeof b === "function") { b = b.name; }
if(typeof complete === "function") { complete = complete.name; }
jnode.machAsyncExec("calldoubler", [ b,complete ], "true", 0);
}

function calldoubler(b,_1) {
complete = function(x) { jnode.remoteAsyncExec(_1, [x], "true", 0); }
var a = b * 2;
complete("hey from doubler");

}
var mbox = {
"functions": {
"doubler": calldoubler,
},
"signatures": {
"doubler": "ns",
}
}
jamlib.registerFuncs(mbox);
jamlib.run(function() { console.log("Running..."); } );
}
wait.launchFiber(main);
