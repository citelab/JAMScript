var ometa = require('../deps/ometa'),
    CParser = require('../lib/c/grammars/c_parser.ojs'),
    CTranslator = require('../lib/c/grammars/c_translator.ojs'),
    readline = require('readline'),
    fs = require('fs');

fs.readFile(process.argv[2], "utf8", function(err, data) {
  if (err) {
    return console.log(err);
  }
  try {
  	tree = CParser.parse(data);
  	output = CTranslator.translate(tree);
    console.log(output);
  } catch(e) {
	    console.log("\t\t\t\t ERROR! Invalid Input");
	}

});
