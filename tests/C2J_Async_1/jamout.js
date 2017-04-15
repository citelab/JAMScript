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
function doubler(b) {
if(typeof b === "function") { b = b.name; }
jnode.machAsyncExec("calldoubler", [ b ], "true", 0);
}

function calldoubler(b) {
var a = b * 2;
console.log("Doubled value: ", a);

}
var mbox = {
"functions": {
"doubler": calldoubler,
},
"signatures": {
"doubler": "n",
}
}
jamlib.registerFuncs(mbox);
jamlib.run(function() { console.log("Running..."); } );
}
wait.launchFiber(main);
