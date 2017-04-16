var Chance = require('chance');
var chance = new Chance();

setInterval(function() {
	ping(chance.name());
}, 1000);

