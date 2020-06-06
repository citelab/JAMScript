#!/usr/bin/env node

var fs = require('fs'),
	path = require('path'),
	jam = require('./lib/ohm/jamscript/jam');

var args = process.argv.slice(2);
var jsPath;
var cPath;


for (var i = 0; i < args.length; i++) {
	var inputPath = args[i];
    var extension = path.extname(inputPath);
    if (extension === '.js') {
        jsPath = inputPath;
    } else if (extension === '.c') {
        cPath = inputPath;
    }
}

if (cPath !== undefined && jsPath === undefined) {
	jam.compileC(fs.readFileSync(cPath).toString());
} else if (cPath === undefined && jsPath !== undefined) {
	jam.compileJS(fs.readFileSync(jsPath).toString());
} else if (cPath !== undefined && jsPath !== undefined) {
	// run the preprocessor + compile both 
}