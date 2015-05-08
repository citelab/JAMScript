require('ometa-js')
var CParser = require('./cparser.ojs')

var readline = require('readline')

var rl = readline.createInterface(process.stdin, process.stdout);
rl.setPrompt('CParser > ');
rl.prompt();


rl.on('line', function(line) {
	if (line === "right") rl.close();

	try {
	    tree = CParser.matchAll(line, 'top')
	} catch(e) {
	    console.log("\t\t\t\t ERROR! Invalid Input");
	}
	rl.prompt();
    }).on('close',function() {
	    process.exit(0);
	});
