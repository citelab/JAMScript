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
function print_msg(msg,_1) {
cb = function(x) { jnode.remoteAsyncExec(_1, [x], "true", 0); }
console.log(msg);
cb("abc");

}
var mbox = {
"functions": {
"print_msg": print_msg,
},
"signatures": {
"print_msg": "ss",
}
}
jamlib.registerFuncs(mbox);
jamlib.run(function() { console.log("Running..."); } );
