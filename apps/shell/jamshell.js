jdata {
	char* jobs as logger;
    struct device {
        int uptime;
        char* nodeType;
        char* nodeName;
    } info as logger;
}

var sys = require('sys');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var chance = require('chance').Chance();

var nodeName = chance.first();
console.log("node name: " + nodeName);

jsync function getNodeName() {
	return nodeName;
}

var readline = require('readline');
var rl = readline.createInterface(process.stdin, process.stdout);

var getNodeInfo = function(key,entry) {
	var i = 0;
	while(info[i] !== undefined && !info[i].isEmpty()) {
		console.log(info[i].lastValue());
		i++;
	}
}

var getJobs = function(key, entry) {
	console.log("HERE IN JOBS");
	var i = 0;
	while(jobs[i] !== undefined && !jobs[i].isEmpty()) {
		console.log("IN LOOP");
		console.log(jobs[i].lastValue());
		i++;
	}
}

rl.setPrompt('>>');
rl.prompt();
rl
	.on('line', function(line) {
		    if (line === "exit"){
				rl.close();
		    }
		    if (line === "pwd") {
		    	console.log(pwd());
		    }
		    if (line === "exec") {
		    	process.chdir("/Users/oryx/progA");
				child = spawn('node', ['jamout.js', '--app=progA']);
				child.stdout.on('data',
		        function (data) {
		            console.log('>'+ data);
		        });
		    	execProg();
		    }
		    if (line === "nodes") {
		    	logInfo();
				getNodeInfo();
		    }
		    if (line === "jobs") {
		    	jobs.subscribe(getJobs);
		    }
		    rl.prompt();
	})
	.on('close',function(){
	    process.exit(0);
	});

