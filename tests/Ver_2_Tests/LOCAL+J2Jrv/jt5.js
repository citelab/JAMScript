let count = 10;

// @Test()

jtask function abc(hello) {
    console.log("Message from controller ...", hello);

	coverage();
	assert();

    count++;
    return count * count;
}

setInterval(()=> {
    if (jsys.type == 'fog') {
	abc("hi").then((x)=> {
	    console.log("Return... ", x.values());
	}).catch(()=> {
	    console.log("Error... ");
	});
    } else 
	console.log("Nothing to call...");

}, 20);
