#!/usr/local/bin/node

var cmdParser = require('./cmdparser.js');
var options = cmdParser();
console.log(options);

if (options.fog === undefined)
    console.log("Not a fog");
else
    console.log("It is a fog..");
