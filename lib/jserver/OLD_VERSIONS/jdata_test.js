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

function hello(msg){
  console.log(msg);
  return "ayyy";
}

//var result_logger = new JLogger("value", true, JManager);

jlib.JServer.registerCallback(jdata_registration, "ss");
jlib.JServer.registerCallback(hello, "s");

/*
setTimeout(function(){ 
  console.log("Check Stuff");
  console.log(result_logger.jlogger_get_newest_value());
 }, 3000)

setTimeout(function(){ 
    //JManager.broadcastMessage("value" , "OI DUDE");
     	jlib.JServer.remoteAsyncExec("hello", ["mcgill university", "montreal", "canada"], "true");
 }, 5000)

*/
program = async(function() {
  console.log("Testing ...");
	value = await (jlib.JServer.remoteSyncExec("hello_sync", ["mcgill university", "we", "canada"], "true"));
	console.log("Return value : " + value);
});

setTimeout(function(){ 
    //JManager.broadcastMessage("value" , "OI DUDE");
    program();
 }, 2000)
/*
 setTimeout(function(){ 
    //JManager.broadcastMessage("value" , "OI DUDE");
     	jlib.JServer.remoteAsyncExec("hello", ["mcgill university", "montreal", "canada"], "true");
 }, 15000)
*/