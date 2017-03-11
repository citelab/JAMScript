var jamlib = require('/usr/local/share/jam/lib/jserver/jamlib');
var jnode = require('/usr/local/share/jam/lib/jserver/jnode');
var JLogger = require('/usr/local/share/jam/lib/jserver/jlogger');
var JManager = require('/usr/local/share/jam/lib/jserver/jmanager');
var async = require('asyncawait/async');
var await = require('asyncawait/await');
var http = require('http');
var cbor = require('cbor');
var qs = require('querystring');
var path = require('path');
var mime = require('mime');
var fs = require('fs');
var jcondition = new Map();
var fs = require("fs");
function isPalindrome(str) {
var half = Math.round(str.length / 2);
var start = 0;
var end = str.length - 1;
var palindrome = true;
var SPACE = 32;
var COMMA = 44;
var startSpace, endSpace;
while (half) {
startSpace = str.charCodeAt(start) === SPACE || str.charCodeAt(start) === COMMA;
;
endSpace = str.charCodeAt(end) === SPACE || str.charCodeAt(end) === COMMA;
;
if (str[start] == str[end]) {
start++;
end--;
} else {
if (startSpace || endSpace) {
startSpace && start++;
endSpace && end--;
} else {
return false;
}
}
half--;
}
return true;
}
var inputs = [];
for (var i = 0; i < 10; i++) {
inputs.push(fs.readFileSync('input' + i + '.txt').toString());
}
console.time("JavaScript");
for (var i = 0; i < 10; i++) {
isPalindrome(inputs[i]);
}
console.timeEnd("JavaScript");
console.time("C");
for (var i = 0; i < 10; i++) {
isPalindromeC(inputs[i]);
}
console.timeEnd("C");
function isPalindromeC(text) {
if(typeof text === "function") { text = text.name; }
jnode.remoteAsyncExec("isPalindromeC", [text], "true");
}
var mbox = {
"functions": {
"isPalindrome": isPalindrome,
},
"signatures": {
"isPalindrome": "s",
}
}
jamlib.registerFuncs(mbox);
jamlib.run(function() { console.log("Running..."); } );
