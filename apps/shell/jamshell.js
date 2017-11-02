jdata {
	//cout is the inflow of progB
	cout as inflow of app://progB.outF;
	//shellOut is the outflow of the shell (from progB)
	shellOut as outflow of cout;
	//Job logger
	char* jobs as logger; //Job logger
	//TODO: This can be removed when device status is kept from the J Node instead
    struct nodeInfo {
    	char* nodeName;
        char* nodeType;
        char* precedingDevice;
    } nodeInfo as logger; //Device info logger
}

/**
* Helper function to parse command line arguments
*/
var CommandParser = (function() {
    var parse = function(str, lookForQuotes) {
        var args = [];
        var readingPart = false;
        var part = '';
        for(var i=0; i<str.length; i++) {
        	if(str.charAt(i) === ' ' && !readingPart) {
                args.push(part);
                part = '';
            } else {
                if(str.charAt(i) === '\"' && lookForQuotes) {
                    readingPart = !readingPart;
                } else {
                    part += str.charAt(i);
                }
            }
        }
        args.push(part);
        return args;
    }
    return {
        parse: parse
    }
})();

var sys = require('sys');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var chance = require('chance').Chance();

/**
* Names the node randomly.
*/
var nodeName = chance.first();
console.log("node name: " + nodeName);

/**
* Get node name.
*/
jsync function getNodeName() {
	return nodeName;
}

/**
* Get node info from connected devices.
*/
var getNodeInfo = function(key,entry) {
	var i = 0;
	while(nodeInfo[i] !== undefined && !nodeInfo[i].isEmpty()) {
		console.log(nodeInfo[i].lastValue());
		i++;
	}
}

/**
* Read and list jobs from the logger.
*/
var getJobs = function(key, entry) {
	var i = 0;
	while(jobs[i] !== undefined && !jobs[i].isEmpty()) {
		console.log(jobs[i].lastValue());
		i++;
	}
}

/**
* This takes care of execing the J node of the execd program
* Spawns a child and listens on the stdout to display output
* @param name of the program being exec'd
*/
var execJNode = function(name) {
    process.chdir("/Users/oryx/" + name);
	var child = spawn('node', ['jamout.js', '--app=' + name]);
	child.stdout.on('data',
    function (data) {
        console.log(''+ data);
    });
}

/**
* Logging utility for self-logging
*/
function log(index, value){
    setTimeout(function() {
    	console.log(nodeInfo.size());
        nodeInfo[index].log(value, function (result) {
            if (!result.status)
                console.log(result.error);
        });
    }, 30);
}

function logJobs(index, value){
    setTimeout(function() {
    	console.log(nodeInfo.size());
        jobs[index].log(value, function (result) {
            if (!result.status)
                console.log(result.error);
        });
    }, 30);
}

/**
* Generate node info and log it
*/
function generateNodeInfo() {
	var val = {
		nodeName: nodeName,
		nodeType: "NODE_TYPE",
		precedingDevice: "TEMP_PARENT"
	};
	log(0,val);
}

function listener(raw) {
	console.log(raw.data);
}

/**
 * User input loop
 */
var readline = require('readline');
var rl = readline.createInterface(process.stdin, process.stdout);
var args = null;
var gen;
var jobList = [];

//Add a new datastream to the logger when a new node comes online
nodeInfo.addDatastream(nodeName);
jobs.addDatastream(nodeName);

//Log the node into logger
gen = generateNodeInfo();

rl.setPrompt('>>');
rl.prompt();
rl
	.on('line', function(line) {
	        /**
	         * Handle redirection
	         * Only prints for now, doesn't write to a file
	         * NOT WORKING!
	         */
	        //TEST COMMAND: exec progB >
			if (line.includes(">")) {
		    	args = CommandParser.parse(line);
		    	if (args[0] == "exec") {
		    		execJNode(args[1]);
		    		execProg(args[1]);
		    		var flow = cout;
		    		flow.addChannel(listener);
		    		// cout.setTerminalFunction(function(entry) {
		    		// 	console.log(entry.data);
		    		// });
		    	}
		    }
		    /**
	         * Handle piping
	         * WORKING!
	         */
		    //TEST COMMAND: exec progB | progC
		    if (line.includes("|")) {
		    	args = CommandParser.parse(line);
		    	console.log(args)	;
		    	if (args[0] == "exec") {
		    		execJNode(args[1]);
		    		execProg(args[1]);
		    		shellOut.start();
		    		execJNode(args[3]);
		    		execProg(args[3]);
		    	}
		    }
		   	/**
		    * Exec a program from the shell
		    * exec progA
		    */
		    if (line.includes("exec")) {
		    	args = CommandParser.parse(line);
		    	execJNode(args[1]);
		    	execProg(args[1]);
		    	jobList.push(args[1]);
		    	logJobs(0,jobList);
		    }
		    /**
		    * Print the current working directory
		    */
		    if (line === "pwd") {
		    	console.log(pwd());
		    }
		    /**
		    * Get node information about the current JAMSystem
		    */
		    if (line === "nodes") {
		    	getNodeInfo();
		    }
		    /**
		    * Get current running jobs
		    * TODO: new method of logging from J node
		    */
		    if (line === "jobs") {
		    	getJobs();
		    }
		    /**
		    * Exit
		    */
		    if (line === "exit"){
				rl.close();
		    }
		    rl.prompt();
	})
	.on('close',function(){
	    process.exit(0);
	});
