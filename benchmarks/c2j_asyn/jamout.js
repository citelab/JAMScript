var jlib = require('/usr/local/share/jam/lib/jserver/jamlib');
var async = require('asyncawait/async');
var await = require('asyncawait/await');
var http = require('http');
var cbor = require('cbor');
var qs = require('querystring');
var path = require('path');
var mime = require('mime');
var fs = require('fs');
var JManager = require('/usr/local/share/jam/lib/jserver/jmanager');
var JLogger = require('/usr/local/share/jam/lib/jserver/jlogger');
var jcondition = new Map();
varnum_calls=0;
function ping_asyn(msg) {
if (msg != "PING") {
console.log("DAMMIT ROBERT ON JAVSCRIPT");
}
num_calls++;

}
function get_num_ping() {
return num_calls;

}
jlib.JServer.registerCallback(get_num_ping, "");
jlib.JServer.registerCallback(ping_asyn, "s");
