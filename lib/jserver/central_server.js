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

var test = new JLogger('stuff');

var host = "127.0.0.1";
var port = 3000;

var server;

function jdata_registration(app_id, device_id){
	return "127.0.0.1"; //for now
}

jlib.JServer.registerCallback(jdata_registration, "ss");

console.log("Initiating Central Server.... ");
var command = "\
function is_prime(num){ \
  if(num == 2)\
    return true;\
  for(var i = 2; i < num; i++){\
    if(num % i == 0)\
      return false;\
  }\
  return true;\
}\
\
function next_prime(num){\
  var ret = num;\
  while(true){\
    if(is_prime(ret))\
      return ret;\
    ret++;\
  }\
}";
var job_queue = [];

function run_sys(){
  for(var i = 0; i < Math.floor(Math.random() * 4 + 1); i++){
    var new_command = command + "\n console.log(next_prime(" + Math.floor(Math.random() * 500000000 + 2) +"));"
    test.log(new_command, received);
  }
  setTimeout(run_sys, 6000);
}

function received(result){
  console.log(result);
}

run_sys();
//console.log(next_prime(912239222))
