var Chance = require('chance');
var chance = new Chance();

jasync function printmsg(msg) {
    console.log("Printing the message: ", msg);
}

setInterval(function() {
    printmsg(chance.name());
}, 1000);

