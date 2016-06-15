var jlib = require('./jamlib'),
	async = require('asyncawait/async'),
	await = require('asyncawait/await'),
	readline = require('readline');


const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
});


rl.setPrompt('J-Core > ');
rl.prompt();

rl.on('line', (line) => {
	var toks = line.split(" ");

	switch (toks[0]) {
		case 'sync':
			sync_test();
			break;
		case 'status':
			console.log("Number of devices: " + jlib.JServer.devCount());
			break;
		case 'help':
			showHelp();
			break;
		default:
			console.log("Invalid command...type 'help' to get more info.");
			break;
	}
	rl.prompt();
}).on('close', () => {
	console.log("Shutting down the J-Core!");
	process.exit(0);
});


function showHelp() {
	console.log("sync\nstatus\nhelp");
}


function async_test(){
	  console.log("Attempting to async ...");
 		process.stdout.write(".");
 		jlib.JServer.remoteAsyncExec("hellofk", ["mcgill university", 343 + i * 10, "canada"], "true");
		setTimeout( async_test, 2000);
}

//setTimeout( async_test, 2000);


function test(a, b, c) {
	console.log("hello.. this is output from j-core");
	console.log(a, b, c);
	return b + c;
}


function testfg(a, b, c) {
	console.log("hello.. this is output from j-core");
	console.log(a, b, c);
	return b - c;
}

var current_temp = 20;
var temp_status = 1;


function custom_sleep(time){
       var start = new Date().getTime();
       var end = start;
       while(end < start + time * 1000) {
                end = new Date().getTime();
       }
}

function timer(a, b, c){
       console.log("Testing ..... Timing for " + b + " seconds");
       var start = new Date().getTime();
  	 	 var end = start;
  		 while(end < start + b * 1000) {
     	 end = new Date().getTime();
  		 }
       console.log("Time Spent Waiting " + (end-start)/1000);
       return end;
}

function process_status(status_msg, status){
       console.log(status);
       if(status == 0){
               console.log(status_msg);
       }else if(status == 1){
               console.log(status_msg);
               console.log("Initiating Reboot Sequence ..... \n");
       }
}

function temp_report(status_msg, temperature){
       console.log(status_msg);
       current_temp = temperature;
       console.log("Temperature Logged at " + current_temp);
}

function status_report(status_msg, status){
	if(temp_status != status){
		temp_status = status;
		console.log("Status has been changed\n");
	}else {
		console.log("No Change... \n");
	}
}

function temp_action(status_msg, status){
       console.log("\n\n-----------COMMENCING OPERATIONS-------------------\n\n");
       console.log(status_msg);
       if(temp_status != status){
               console.log("Action taken\n");
							 process.stdout.write(".");
               //jlib.JServer.remoteAsyncExec("hellofk", ["mcgill university", 343 + i * 10, "canada"], "true");
               //jlib.JServer.remoteAsyncExec("set_temp_control", ["set_temp_control", "Changing Action... \n", status], "true");
               temp_status = status;
							 sync_call = async(function() {
								 value = await (jlib.JServer.remoteSyncExec("set_temp_control", ["set_temp_control", "Changing Action... \n", status], "true"));
								 	console.log("Return value : " + value);
							 });
							 sync_call();
       }else{
               console.log("No New Action Required\n");
       }
}

var ID = 1;
var msg_id = 1;
var msg_list = ["Chat Service Initiated...\n"];
function get_past_msg(num_msg){
	var begin = 0;
	var end = num_msg;
	var ret = "";
	if(num_msg > msg_list.length){
		begin = msg_list.length - num_msg;
	}else{
		end = 0;
	}
	ret += msg_list.slice(begin, end).join("");
	ret.replace(',','');
	console.log("We are sending.... \n-------------------------------------------------\n" + ret)
	return ret;
}

function get_new_id(status_msg){
	console.log(status_msg + " and " + ID);
	ID += 1;
	return ID;
}

function j_node_get_msg(usr_name, msg, user_id){
	console.log("\n----------------Server Message Received-------------\n" + usr_name + ": " + msg);
	msg_list.push(usr_name + ":" + msg);
	//process.stdout.write(".");
	//jlib.JServer.remoteAsyncExec("hellofk", ["mcgill university", 343 + i * 10, "canada"], "true");
	jlib.JServer.remoteAsyncExec("c_node_get_msg", [usr_name, msg, user_id, msg_id++], "true");
	/*sync_call = async(function() {
		value = await (jlib.JServer.remoteSyncExec("c_node_get_msg", [usr_name, msg, user_id], "true"));
		 console.log("Return value : " + value);
	});*/
	//sync_call();
}

jlib.JServer.registerCallback(j_node_get_msg, "ssn");
jlib.JServer.registerCallback(get_new_id, "s");
jlib.JServer.registerCallback(get_past_msg, "n");
jlib.JServer.registerCallback(test, "snn");
jlib.JServer.registerCallback(testfg, "snn");
jlib.JServer.registerCallback(timer, "snn");
jlib.JServer.registerCallback(process_status, "sn");
jlib.JServer.registerCallback(temp_report, "sn");
jlib.JServer.registerCallback(temp_action, "sn");
jlib.JServer.registerCallback(status_report, "sn");

//

program = async(function() {
	value = await (jlib.JServer.remoteSyncExec("hellofk", ["mcgill university", 343 + 10, "canada"], "true"));
	console.log("Return value : " + value);
});


function sync_test(){
	  console.log("Attempting to sync ...");
		program();
		setTimeout( sync_test, 2000);
}

//sync_test();
