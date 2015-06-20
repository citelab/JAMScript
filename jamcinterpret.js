var ometa = require('./deps/ometa'),
    JAMCParser = require('./lib/jamc/grammars/jamc_parser.ojs'),
    // JAMCTranslator = require('./lib/jamc/grammars/jamc_translator.ojs'),
    readline = require('readline'),
    fs = require('fs');

var rl = readline.createInterface(process.stdin, process.stdout);
rl.setPrompt('CParser > ');
rl.prompt();


rl.on('line', function(line) {
	if (line === "right") rl.close();

	try {
	    tree = JAMCParser.parse(line);
        console.log("Tree = ", tree);
	} catch(e) {
	    console.log("\t\t\t\t ERROR! Invalid Input");
	}
	rl.prompt();
    }).on('close',function() {
	    process.exit(0);
	});
