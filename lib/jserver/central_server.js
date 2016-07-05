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
  console.log("Device Registered with ID " + device_id);
  registered_devices.push({"app_id":app_id, "dev_id":device_id, "avail":true, "logger":new JLogger(device_id), "last_contact":0});
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

var server_time;
var registered_devices = [];
var job_queue = [];
var result_logger = new JLogger("results");

function create_job(){
  for(var i = 0; i < Math.floor(Math.random() * 4 + 1); i++){
    job_queue.push(Math.floor(Math.random() * 500000 + 2));
    console.log("Job Added ...");
  }
}

function run_sys(){
  console.log("Attempting to schedule work ... ");
  for(var i = 0; i < registered_devices.length; i++){
    if(registered_devices[i].avail && job_queue.length > 0){
      var new_command = command + "\n var result = next_prime(" + job_queue.pop() +"); print(result); result+\" \";"
      JManager.broadcastMessage(registered_devices[i].dev_id , new_command);
      registered_devices[i].avail = false;
      server_time = new Date();
      registered_devices[i].last_contact = server_time.getDate();
    }
  }
  setTimeout(run_sys, 6000);
}

function received(result){
  console.log(result);
}

create_job();
run_sys();

//console.log(next_prime(912239222))
