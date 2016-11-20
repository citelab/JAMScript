var jlib = require('./jamlib'),
    async = require('asyncawait/async'),
    await = require('asyncawait/await'),
    readline = require('readline');

var http = require('http');
var cbor = require('cbor');
var qs = require('querystring');
var path = require('path');
var mime = require('mime');
var fs = require('fs');

var JManager = require('./jmanager');
var JLogger = require('./jlogger');

var test = new JLogger('test');

var host = "127.0.0.1";
var port = 3000;

var server;

function jdata_registration(app_id, device_id){
	return "127.0.0.1"; //for now
}



jlib.JServer.registerCallback(jdata_registration, "ss");
