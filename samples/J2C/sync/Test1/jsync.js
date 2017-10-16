
function runsynctest()
{
    var q = hello('test');
    console.log("Received the results..");
    console.log(q);
}

setInterval(function() {
	runsynctest();
    }, 10);
