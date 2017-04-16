
function runsynctest()
{
    var q = hello('testing string..');
    console.log("Received the results..");
    console.log(q);
}

setInterval(function() {
	runsynctest();
    }, 1000);
