let count = 10;

// @ToasterConfig
// Fogs: 1
// Devices: 1

jtask* function xyz(hello) {
    console.log("Message from controller ...", hello);
}

setInterval(()=> {
    if (jsys.type == 'fog') {
		xyz("hi").catch((e)=> {
			console.log(e);
		});
	}
}, 1000);
