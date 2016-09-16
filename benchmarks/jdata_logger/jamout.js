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
var num_bugs = new JLogger("num_bugs", false, JManager);
var jcondition = new Map();
setTimeout(function () {
console.log(num_bugs.jlogger_get_newest_value());
}, 5000);
