var readline = require('readline');

var rl = readline.createInterface(process.stdin, process.stdout);
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
		    rl.prompt();
	})
	.on('close',function(){
	    process.exit(0);
	});
