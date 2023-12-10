jcond {
    fogonly: jsys.type == "fog";
}

let counter = 1;

function afterDelay(n, x) {
    return new Promise((resolve, reject) => {
        setTimeout(()=> {resolve(x)}, n);
    });
}

jtask {fogonly} function getId() {
    console.log("In getId...");
    afterDelay(5000, 555).then((x)=> {
		resolve(x);
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
