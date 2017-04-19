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
jcondition.set('fogonly', { source: 'jcondition_context['sys.type'] == 10', code: 0 });
function pong() {
jnode.machAsyncExec("pong", [  ], "jcondition.get('fogonly').source", 0);
}

function callpong() {
console.log("pong..");
ping();

}var mbox = {
"functions": {
"pong": callpong,
},
"signatures": {
"pong": "",
}
}
jamlib.registerFuncs(mbox);
jamlib.run(function() { console.log("Running..."); } );
}
wait.launchFiber(main);
