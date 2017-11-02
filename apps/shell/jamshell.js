jdata {

	cout as inflow of app://progB.outF;
	shellOut as outflow of cout;

	char* jobs as logger; //Job logger
    struct device {
        int uptime;
        char* nodeType;
        char* nodeName;
    } info as logger; //Device info logger
}

var sys = require('sys');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var chance = require('chance').Chance();

//var jobList = jobs.get_all_values();
//var jobList = [];

var nodeName = chance.first();
console.log("node name: " + nodeName);

/**
* Get node name from C node.
*/
jsync function getNodeName() {
	return nodeName;
}

/**
* Get node info from connected devices.
* TODO: Move node info to the J node and log directly.
*/
var getNodeInfo = function(key,entry) {
	var i = 0;
	while(info[i] !== undefined && !info[i].isEmpty()) {
		console.log(info[i].lastValue());
		i++;
	}
}

/**
* Read and list jobs from the logger.
* TODO: Move job tracking to the J node and log directly.
*/
var getJobs = function(key, entry) {
	console.log("HERE IN JOBS");
	var i = 0;
	while(jobs[i] !== undefined && !jobs[i].isEmpty()) {
		console.log("IN LOOP");
		console.log(jobs[i].lastValue());
		i++;
	}
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


var execJNode = function(name) {
    process.chdir("/Users/oryx/" + name);
	var child = spawn('node', ['jamout.js', '--app=' + name]);
	child.stdout.on('data',
    function (data) {
        console.log(''+ data);
    });
}

/**
 * User input loop
 */
var readline = require('readline');
var rl = readline.createInterface(process.stdin, process.stdout);
var args = null;

rl.setPrompt('>>');
rl.prompt();
rl
	.on('line', function(line) {
	        /**
	         * Handle redirection
	         */
	        //exec progB >
			if (line.includes(">")) {
		    	args = CommandParser.parse(line);
		    	if (args[0] == "exec") {
		    		execJNode(args[1]);
		    		execProgB();
		    		cout.setTerminalFunction(function(entry) {
		    			console.log(entry.data);
		    		});
		    	}
		    }
		    //exec progB | progC
		    if (line.includes("|")) {
		    	args = CommandParser.parse(line);
		    	console.log(args)	;
		    	if (args[0] == "exec") {
		    		execJNode(args[1]);
		    		execProgB();
		    		shellOut.start();
		    		execJNode(args[3]);
		    		execProgC();
		    	}
		    }
		    /**
		    * Exit
		    */
		    if (line === "exit"){
				rl.close();
		    }
		    /**
		    * Print the current working directory
		    */
		    if (line === "pwd") {
		    	console.log(pwd());
		    }
		   	/**
		    * Exec a program from the shell
		    */
		    if (line.includes("exec")) {
		    	args = CommandParser.parse(line);
		    	execJNode(args[1]);
		        //jobList.push("progA");
		        //console.log("Added progA to job list");
		        //jobs = jobList;
		        //console.log("persisted job list to storage");
		    	execProg();
		    }
		    /**
		    * Get node information about the current JAMSystem
		    */
		    if (line === "nodes") {
		    	//logInfo();
				//getNodeInfo();
		    }
		    /**
		    * Get current running jobs
		    */
		    if (line === "jobs") {
		    	//jobs.subscribe(getJobs);
		    }
		    rl.prompt();
	})
	.on('close',function(){
	    process.exit(0);
	});
