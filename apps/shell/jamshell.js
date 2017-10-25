jdata {
    struct device {
        float uptime;
        char* nodeType;
    } info as logger;
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
		    	exec();
		    }
		    if (line === "nodes") {
		    	logInfo();
				getNodeInfo();
		    }
		    rl.prompt();
	})
	.on('close',function(){
	    process.exit(0);
	});

