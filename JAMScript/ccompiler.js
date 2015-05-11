require('ometa-js')
var CParser = require('./cparser.ojs')

fs = require('fs')


// Command line parsing for the correct arguments
// Should be replaced with the 'getopt' NPM module
//
// This is very ugly stuff..
//
if (process.argv.length < 3) {
    console.log("Invalid number of args");
    process.exit(1);
}

var fpath = process.argv[2];

fs.exists(fpath, function(exists) {
        if (exists) {
            console.log("it's there");
        } else {
            console.log("no file");
            process.exit(1);
        }
    });

fs.readFile(fpath, 'utf8', function (err,data) {
   	if (err) {
      return console.log(err);
   }
        try {
            CParser.parse(data);
        } catch (err) {
            console.log(err);
        }
   });
