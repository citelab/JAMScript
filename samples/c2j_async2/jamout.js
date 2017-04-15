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
var Chance = require('chance');
var chance = new Chance();
setInterval(function () {
ping(chance.name());
}, 1000);

function ping(name) {
if(typeof name === "function") { name = name.name; }
jnode.remoteAsyncExec("ping", [ name ], "true", 0);
}

var mbox = {
"functions": {
},
"signatures": {
}
}
jamlib.registerFuncs(mbox);
jamlib.run(function() { console.log("Running..."); } );
}
wait.launchFiber(main);
