
function testping() {
    console.log("Pinging..");
	ping();
}

setInterval(function() {
	console.log("Pinging...");
	testping();
    }, 2000);
