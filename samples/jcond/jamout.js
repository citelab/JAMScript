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
jcondition.set('fogonly', 'jcondition_context["version"] > 1.0');function pong() {
var jcondition_context = jnode.get_jcond();
if(!(eval(jcondition.get(fogonly)))){
console.log(jnode.jcond_failure);
jnode.jcond_failure;
}
console.log("pong..");
ping();

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
