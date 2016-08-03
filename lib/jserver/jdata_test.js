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

var host = "127.0.0.1";
var port = 3000;

var server;

/*
function broadcast_stuff(){
  JManager.broadcastMessage("x" , "232323");
  JManager.broadcastMessage("y" , "aasdsa");
  JManager.broadcastMessage("z" , "ho");
  JManager.broadcastMessage("j", "why");
  console.log("Broadcasting ...");
  setTimeout(broadcast_stuff, 2000);
}
setTimeout(broadcast_stuff, 2000);
*/
function jdata_registration(app_id, device_id){
  console.log("Device Registered with ID " + device_id);
  //registered_devices.push({"app_id":app_id, "dev_id":device_id, "avail":true, "last_contact":0});
  return "127.0.0.1"; //for now
}

var result_logger = new JLogger("testing", true, JManager);

jlib.JServer.registerCallback(jdata_registration, "ss");
