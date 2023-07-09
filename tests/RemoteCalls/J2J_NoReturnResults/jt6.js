let count = 10;

// @ToasterConfig
// Fogs: 1
// Devices: 1

jtask* function xyz(hello) {
    console.log("Message from controller ...", hello);
}

jtask* function abc(x) {
    console.log("Message from controller... ", x);
}

setInterval(()=> {
    if (jsys.type == 'fog') {
		xyz("hi").catch((e)=> {
			console.log(e);
		});
    }

    if (jsys.type == 'device') {
	abc("hello").catch((e)=> {
	    console.log(e);
	});
    }
}, 1000);
