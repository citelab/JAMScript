#!/usr/local/bin/node

var cmdParser = require('./cmdparser.js');

var cmdopts = cmdParser();
console.log(cmdopts);

if (cmdopts.registry === undefined)
	console.log("Registry not required");
else
	console.log("Registry required..");