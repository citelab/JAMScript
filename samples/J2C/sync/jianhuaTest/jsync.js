
function runsynctest()
{
    var q = fakeRandom('testing string..');
    var p = realRandom('whatever');
    console.log("Received the results..");
    console.log(q);
	console.log(p);
}

setInterval(function() {
	runsynctest();
    }, 200);
