
function testping() {
    console.log("Pinging..");
	ping();
}

setTimeout(function() {
	console.log("Pinging...");
	for (i = 0; i < 100000; i++)
	    testping();
    }, 5000);
