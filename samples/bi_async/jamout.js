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
function pong() {
console.log("pong..");
ping();

}
function ping() {
jnode.remoteAsyncExec("ping", [  ], "true", 0);
}
var mbox = {
"functions": {
"pong": pong,
},
"signatures": {
"pong": "",
}
}
jamlib.registerFuncs(mbox);
jamlib.run(function() { console.log("Running..."); } );
