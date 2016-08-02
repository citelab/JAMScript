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
var result_queue = [];

function create_job(){
  for(var i = 0; i < Math.floor(Math.random() * 4 + 1); i++){
    job_queue.push(Math.floor(Math.random() * 20000000 + 2));
    console.log("Job Added ...");
  }
}

function run_sys(){
  var num_work = 0;
  console.log("Attempting to schedule work ... ");
  for(var i = 0; i < registered_devices.length; i++){
    if(registered_devices[i].avail && job_queue.length > 0){
      var new_command = command + "\n var result = next_prime(" + job_queue.pop() +"); print(result); result+\" \";"
      jlib.JServer.remoteAsyncExec("run_task_thread", [device_id, new_command], "true");
      //Async has no return so we won't get a fail ....
      //But if we did for sync
      // value = await (jlib.JServer.remoteSyncExec("run_task_thread", [device_id, new_command], "true"));
      // if(value == jlib.JServer.jcond_failure){
      //    console.log(jlib.JServer.jcond_failure))
      //    return;
      //}
      registered_devices[i].avail = false;
      server_time = new Date();
      registered_devices[i].last_contact = server_time.getDate();
      num_work++;
    }
  }
  console.log("Scheduled " + num_work + " resource with work .. ");
  if(job_queue.length <= 4){
    create_job();
  }
  setTimeout(run_sys, 6000);
}

//Let's say we have this
//jcond device_id = '{ "device_id":7, "key":2}'
//jcond device_type = { "type":"central_server"}'
//let's say we have jsync {device_id && device_type} void process_response(response)

//in reality we would have something like
var device_id = 'jcondition_context["device_id"] == 8'
var device_type = 'jcondition_context["type"] == "central_server"'
//that robert will have to do
function process_response(response, dev_id){
     var jcondition_context = jlib.JServer.get_jcond();
     if(!(eval(device_id) && eval(device_type))){
       console.log(jlib.JServer.jcond_failure);
       return jlib.JServer.jcond_failure;
     }
     var found = false;
     for(var i = 0; i < registered_devices.length; i++){
       console.log(dev_id + " " + registered_devices[i].dev_id)
       if(dev_id === registered_devices[i].dev_id){
         registered_devices[i].avail = true;
         found = true;
         console.log("Result: " + response);
         result_queue.push(response);
         break;
        }
      }
      if(!found)
       console.log("Device not found ...\n");

      return jlib.JServer.jcond_success;
 }

function jdata_registration(app_id, device_id){
  console.log("Device Registered with ID " + device_id);
  registered_devices.push({"app_id":app_id, "dev_id":device_id, "avail":true, "last_contact":0});
  return "127.0.0.1"; //for now
}
function test(a, b, c) {
	console.log("hello.. this is output from j-core");
	console.log(a, b, c);
	return b + c;
}

jlib.JServer.registerCallback(test, "snn");
jlib.JServer.registerCallback(process_response, "ss");
jlib.JServer.registerCallback(jdata_registration, "ss");

console.log("Initiating Central Server.... ");
create_job();
run_sys();
