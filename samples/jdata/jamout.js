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
setInterval(function () {
console.log(x);
if (x.get_newest_value !== undefined) {
if (Number(x.get_newest_value.log) > 1.0) {
JManager.broadcastMessage("y", String(Number(4)));
;
}
}
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
