var ometa = require('./deps/ometa'),
    CParser = require('./lib/c/grammars/c_parser.ojs'),
    CTranslator = require('./lib/c/grammars/c_translator.ojs'),
    readline = require('readline'),
    fs = require('fs');

var rl = readline.createInterface(process.stdin, process.stdout);
rl.setPrompt('CParser > ');
rl.prompt();


rl.on('line', function(line) {
	if (line === "right") rl.close();

	try {
	    tree = CParser.parse(line);
        console.log("Tree = ", tree);
        console.log("=================");
        output = CTranslator.translate(tree);
        console.log("output =", output);
	} catch(e) {
	    console.log("\t\t\t\t ERROR! Invalid Input");
	}
	rl.prompt();
    }).on('close',function() {
	    process.exit(0);
	});
