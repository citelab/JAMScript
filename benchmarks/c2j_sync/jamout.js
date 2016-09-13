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
function ping_sync(msg) {
if (msg != "PING") {
console.log("DAMMIT ROBERT ON JAVSCRIPT");
}
return "PONG";

}
