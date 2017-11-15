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
        char* fog;
        char* cloud;
    } nodeInfo as logger; //Device info logger
}

jcond {
	cloudonly: sys.type == "cloud";
}

var argv = require('yargs').argv


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
var fs = require('fs');
var jobList = [];

/**
* Names the node randomly.
*/
var nodeName = chance.first();
console.log("node name: " + nodeName);

var cloudName;
var fogName;

var selfInfo = {"name": nodeName, "type": jsys.type};
jsys.ad_up('name',selfInfo)

jsys.ad_up_fogcback('name', function(x) {
	console.log(x.name);
});
jsys.ad_up_cloudcback('name', function(x) {
	console.log(x.name);
});

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

// var advertiseSelf = function() {
// 	jamsys.ad_up('name',selfInfo)
// }

/**
* This takes care of execing a program
* Spawns a child and listens on the stdout to display output
* @param relative path of the program being exec'd
*/
var executeProgram = function(path) {
	var currPath = process.cwd();
	var progPath = process.cwd() + "/" + path;
	var progName = path.split("/").slice(-1)[0]
    process.chdir(progPath);
	var child = spawn('node', ['jamout.js', '--app=' + progName, '--data=' + argv.data]);
	jobList.push(child.pid);
	console.log("Pushed child: "+ child.pid + " to joblist");
	process.chdir(currPath);
	child.stdout.on('data',
    function (data) {
        console.log(''+ data);
    });
	execProg(progPath, progName);
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
		nodeType: jsys.type,
		fog: fogName,
		cloud: cloudName
	};
	log(0,val);
}

function listener(raw) {
	console.log(raw.data);
}

jasync {cloudonly} function execAtCloud(path) {
	console.log("execAtCloud received: " + path);
	executeProgram(path);
}

jasync function changeDirectory(path) {
	console.log("jcd received");
	process.chdir(path);
}

/**
 * User input loop
 */
var readline = require('readline');
var rl = readline.createInterface(process.stdin, process.stdout);
var args = null;
var gen;

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
	         */
	        //TEST COMMAND: exec progB >
	        // fileD.txt > progD
			if (line.includes(">")) {
		    	args = CommandParser.parse(line);
		    	if (args[0] == "exec") {
		    		executeProgram(args[1]);
		    		var flow = cout;
		    		flow.addChannel(listener);
		    	}
		    	// fileA => shell.inflow ==> shell.outflow ==> progD.inflow
		    	if (args[1] == ">") {
		    		var fileInputFlow = Flow.from("fs:///Users/oryx/fileD.txt").foreach((line) => console.log(line));
		    		executeProgram(args[2]);
		    	}
		    }
		    /**
	         * Handle piping
	         */
		    //TEST COMMAND: exec progB | progC
		    if (line.includes("|")) {
		    	args = CommandParser.parse(line);
		    	console.log(args)	;
		    	if (args[0] == "exec") {
		    		executeProgram(args[1]);
		    		shellOut.start();
		    		executeProgram(args[3]);
		    	}
		    }

		    /**
		    * Handle location commands
		    */
		    // exec @all progA
		    if (line.includes("@")) {
		    	console.log("Received @location commands");
		    	args = CommandParser.parse(line);
		    	console.log(args);

		    	console.log(args[1]);

		    	if (args[1] == "@all") {
		    		console.log("Receieved @all command");
		    		//Call to C (which can call all Js)
		    		if (args[0] == 'exec') {
		    			console.log("Received exec @all command");
		    			execProgGlobal(args[2]);
		    			console.log("Exiting");
		    		}
		    	}
		    }

		   	/**
		    * Exec a program from the shell
		    * exec progA
		    */
		    // if (line.includes("exec")) {
		    // 	console.log("Entered vanilla exec function");
		    // 	args = CommandParser.parse(line);
		    // 	executeProgram(args[1]);
		    // 	logJobs(0,jobList);
		    // }
		    /**
		    * Print the current working directory
		    */
		    if (line === "jpwd") {
		    	console.log("jpwd receieved");
		    	console.log(process.cwd());
		    }
		    /**
		    * Changes directory
		    */
		    if (line.includes("jcd")) {
				args = CommandParser.parse(line);
				changeDirectory(args[1]);
		    }
		    if (line === "jls") {
		    	fs.readdir(process.cwd(), (err, files) => {
  					files.forEach(file => {
    					console.log(file);
  					});
				})
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
            if (line === "names") {
                console.log("fogName: ", fogName);
                console.log("cloudName: ", cloudName);                
            }
		    /**
		    * Exit
		    */
		    if (line === "exit"){
				console.log('killing', jobList.length, 'child processes');
				jobList.forEach(function(job) {
					process.kill(job);
				});
				rl.close();
		    }
		    rl.prompt();
	})
	.on('close',function(){
			console.log('killing', jobList.length, 'child processes');
			jobList.forEach(function(job) {
				process.kill(job);
			});
	    process.exit(0);
	});
