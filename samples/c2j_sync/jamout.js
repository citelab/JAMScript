var jamlib = require('/usr/local/share/jam/lib/jserver/jamlib');
var jnode = require('/usr/local/share/jam/lib/jserver/jnode');
var async = require('asyncawait/async');
var await = require('asyncawait/await');
var http = require('http');
var cbor = require('cbor');
var qs = require('querystring');
var path = require('path');
var mime = require('mime');
var fs = require('fs');
var jcondition = new Map();
function add(num1,num2) {
return num1 + num2;

}
function subtract(num1,num2) {
return num1 - num2;

}
function multiply(num1,num2) {
return num1 * num2;

}
function divide(num1,num2) {
return num1 / num2;

}
var mbox = {
"functions": {
"add": add,
"subtract": subtract,
"multiply": multiply,
"divide": divide,
},
"signatures": {
"add": "nn",
"subtract": "nn",
"multiply": "nn",
"divide": "nn",
}
}
jamlib.registerFuncs(mbox);
jamlib.run(function() { console.log("Running..."); } );
