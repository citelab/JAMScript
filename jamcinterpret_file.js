var ometa = require('./deps/ometa'),
    JAMCParser = require('./lib/jamscript/grammars/jamc_parser.ojs'),
    JAMCTranslator = require('./lib/jamscript/grammars/jamc_translator.ojs'),
    readline = require('readline'),
    fs = require('fs');

fs.readFile("tests/pre_jam.c", "utf8", function(err, data) {
  if (err) {
    return console.log(err);
  }
  try {
  	console.log(data);
  	tree = JAMCParser.parse(data);
  	console.log("Tree = ", tree);
  	console.log("=================");
  	output = JAMCTranslator.translate(tree);
    console.log("output =", output);
  } catch(e) {
	    console.log("\t\t\t\t ERROR! Invalid Input");
	}
});