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
  	// console.log("Tree = ", tree);
  	// console.log("=================");
  	output = JAMCTranslator.translate(tree);
    fs.writeFile("tests/jamout.c", output.C, function(err) {
      if(err) {
          return console.log(err);
      }
    });
    fs.writeFile("tests/jamout.js", output.JS, function(err) {
      if(err) {
          return console.log(err);
      }
    }); 
    fs.writeFile("tests/annotated_jamout.js", output.annotated_JS, function(err) {
      if(err) {
          return console.log(err);
      }
    });
    var toml = "";
    toml += "# Description of the JXE structure\n";
    toml += "title = \"JAMScript Executable Description\"\n";

    toml += "# global identification and requirements are specified next\n";
    toml += "[jxe]\n";
    toml += "version = 1.0\n";
    toml += "checksum = \"XXXDFDFDFDFDF\"\n";
    toml += "requirements = \"none\"\n";

    toml += "# javascript portion is in one file for now\n";
    toml += "[jsfile]\n";
    toml += "# any or a particular version can be specified for nodeversion\n";
    toml += "nodeversion = 0\n";
    toml += "# list of modules that should be pre-loaded into Node\n";
    toml += "requires = []\n";
    toml += "# file name for the javascript code\n";
    toml += "file = \"jamout.js\"\n";

    toml += "# c portion could be in multiple files (in shared lib format)\n";
    toml += "[cfile]\n";
    toml += "portions = 1\n";
    toml += "# definition of a C portion\n";
    toml += "[cfile.1]\n";
    toml += "# architecture for which the shared library is genereated\n";
    toml += "arch = \"x86\"\n";
    toml += "# requirements of the shared library; these are tags that indicate the requirements\n";
    toml += "requires = []\n";
    toml += "# filename of the shared library\n";
    toml += "file = \"libjamout.so\"\n";
    fs.writeFile("tests/MANIFEST.tml", toml, function(err) {
      if(err) {
          return console.log(err);
      }
    });
  } catch(e) {
	    console.log("\t\t\t\t ERROR! Invalid Input");
	}
});