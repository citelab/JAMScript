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
var xx = new JLogger("xx", false, JManager);
var jcondition = new Map();
function js_read() {
setTimeout(function () {
console.log(xx.jlogger_get_newest_value());
}, 2000);

}
jlib.JServer.registerCallback(js_read, "");
