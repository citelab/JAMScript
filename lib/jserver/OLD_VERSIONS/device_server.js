var jlib = require('./jamlib'),
	async = require('asyncawait/async'),
	await = require('asyncawait/await'),
	readline = require('readline');

var ID_GENERATOR = 0;
var registered_device = [];
var work_sent = [];
var d = new Date();

function register_device(device_type, status_msg, type){
	console.log(status_msg);
	registered_device.push({"name":device_type + "-" + ID_GENERATOR, "status":0, "type":type});
	console.log("Device " + registered_device[ID_GENERATOR].name + " has been registered");
	return registered_device[ID_GENERATOR++].name;
}

function report_device(device_id, status_msg){
	for(var i = 0; i < registered_device.length; i++){
		if(registered_device[i].name.localeCompare(device_id)){
			registered_device[i].status = 0;
			work_sent.splice(i, 1);
			break;
		}
	}
	console.log("Device " + device_id + " just reported " + status_msg);
}

function report_device_work(device_id, status_msg){
	for(var i = 0; i < registered_device.length; i++){
		if(registered_device[i].name.localeCompare(device_id)){
			registered_device[i].status = 0;
			break;
		}
	}
	console.log("Device " + device_id + " just reported " + status_msg);
}

function update_device_list(){
	for(var i = 0; i < registered_device.length; i++){
	if(registered_device[i].status >= 3){
		console.log("Device " + registered_device[i].name + " is dead ... ");
		registered_device[i].status++;
		}
	}
	console.log("Current Work Status: %o", work_sent);
	console.log("Checking Status Of Devices ...");
	jlib.JServer.remoteAsyncExec("alive", ["STILL ALIVE?"], "true");
	setTimeout(update_device_list , 4000);
}

function generate_async_work(){
	var type = parseInt(Math.random() * 6, 10);
	var device_list = "";
	for(var i = 0; i < registered_device.length; i++){
		if(registered_device[i].type == type && registered_device[i].status <= 2){
			device_list += registered_device[i].name + "/";
			work_sent.push({"device_id":registered_device[i].name, "timestamp": d.getTime()});
		}
	}
	console.log("Sending Work Request to " + device_list);
	jlib.JServer.remoteAsyncExec("workasync", [device_list], "true");
	setTimeout(generate_async_work, 15000);
}

function generate_sync_work(){
	var type = parseInt(Math.random() * 6, 10);
	var sync = async(function() {
		value = await (jlib.JServer.remoteSyncExec("worksync", ["Syncing"], "true"));
		console.log("Return value : " + value);
	});
	for(var i = 0; i < registered_device.length; i++){
		if(registered_device[i].type == type && registered_device[i].status <= 2){
			console.log("Attempting Sync Work... ")
			var result = sync();
			console.log("Result is ... " + result);
		}
	}
	setTimeout(generate_sync_work, 60000);
}

setTimeout(update_device_list, 10000);
setTimeout(generate_sync_work, 3000);
setTimeout(generate_async_work, 5000);

jlib.JServer.registerCallback(register_device, "ssn");
jlib.JServer.registerCallback(report_device, "ss");
jlib.JServer.registerCallback(report_device_work, "ss");
