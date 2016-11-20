var jlib = require('./jamlib'),
    async = require('asyncawait/async'),
    await = require('asyncawait/await'),
    readline = require('readline');

//var http = require('http');
var cbor = require('cbor');

var JManager = require('./jmanager');
var JLogger = require('./jlogger');

var host = "127.0.0.1";
var port = 3000;

var server;

function process_work_request(user_id, msg){
    console.log("User:" + user_id)
    var result = JSON.parse(msg);
    console.log(JSON.stringify(result));
}

jlib.JServer.registerCallback(process_work_request, "ss");

