jcond {
    cloudonly: jsys.type == "cloud";
    fogonly: jsys.type == "fog";
}

let counter = 1;

jtask {cloudonly} function getCloudId() {
    console.log("getCloudId... callled.. ", counter);
    resolve (counter++);
}

jtask {fogonly} function getId() {
    console.log("In getId...");
    getCloudId().then((x)=> {
	console.log("Cloud Id", x.values());
	resolve(10);
    }).catch((err)=> {
	consol.log("Error.. ", err);
    });
}

async function getMyIndx() {
    let count = 0;
    let retry = setInterval(()=> {
	getId().then((y)=> {
	    console.log("y - ", y.values());
	    if (y.values().length > 0) {
		clearInterval(retry);
		return y.values()[0];
	    }
	}).catch((err)=> {
	    console.log("Device error.. ", err);
	});
	count++;
	if (count > 10) {
	    clearInterval(retry);
	    return -1;
	}
    }, 1000);
}    

if (jsys.type === "device") {
    let myindx = await getMyIndx();

    if (myindx < 0)
	process.exit(1);

    console.log("My index... ", myindx);
}

