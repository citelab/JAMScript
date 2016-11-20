var portastic = require('./portastic');

portsArray = [];


function addFreePorts(minp, maxp, pArray) {
    portastic.find({
	min:minp,
	    max:maxp}).then(function(ports) {
		    pArray = pArray.concat(ports);
		});
}

addFreePorts(20000, 30000, portsArray);