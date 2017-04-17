var Chance = require('chance');
var chance = new Chance();

jasync function printmsg(msg) {
    console.log("Printing the message: ", msg);
}

setInterval(function() {
	console.log("Calling print message...");
    printmsg(chance.name());
}, 1000);

