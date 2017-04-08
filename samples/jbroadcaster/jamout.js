var jamlib = require('/usr/local/share/jam/lib/jserver/jamlib');
var jnode = require('/usr/local/share/jam/lib/jserver/jnode');
var http = require('http');
var cbor = require('cbor');
var qs = require('querystring');
var path = require('path');
var mime = require('mime');
var fs = require('fs');
var wait = require('wait.for-es6');
var JAMLogger = require('/usr/local/share/jam/lib/jserver/jamlogger');
var JAMManager = require('/usr/local/share/jam/lib/jserver/jammanager');
function* main() {
var jcondition = new Map();
var Chance = require('require');
var chance = new Chance();
setInterval(function () {
JAMManager.broadcastMessage("y", String(Number(chance.name())));
;
}, 1000);

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
