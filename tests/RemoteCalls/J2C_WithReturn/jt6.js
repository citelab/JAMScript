let count = 10;

setInterval(()=> {
    if (jsys.type === 'fog')
	get_a_value(count++).then((y)=> {
            console.log("Return value from the call..", y.values());
	}).catch(()=> {
	    console.log("Error.....");
	});
}, 1000);
