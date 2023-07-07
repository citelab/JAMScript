let count = 10;

setInterval(()=> {
    get_a_value(count++).then((y)=> {
        console.log("Return value from the call..", y.values());	
    }).catch(()=> {
	console.log("Error.....");
    });
}, 20);
