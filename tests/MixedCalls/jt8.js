jcond {
    cloudonly: jsys.type == "cloud";
    fogonly: jsys.type == "fog";
}

let counter = 1;
let gidtbl = new Map();

jtask {cloudonly} function getCloudId(uid) {
	let id = gidtbl.get(uid);
	if (id === undefined) {
		id = counter++;
		gidtbl.set(uid, id);
	}
	console.log("Id... ", id);
    resolve (id);
}

jtask {fogonly} function getId(uid) {
	let repeatStop = 0;
	(function repeatBody() {
		console.log("______________________ ", uid);
		getCloudId(uid).then((x)=> {
			console.log("Cloud Id", x.values());
			if (x.values().length > 0) {
				repeatStop = 1;
				resolve(x.values()[0]);
			}
		}).catch((err)=> {
			console.log("Error.. ", err);
		});
		if (repeatStop === 0)
			setTimeout(repeatBody, 2000);
	})();
}

async function getMyIndx() {
    let count = 0;

	return new Promise((resolve, reject)=> {
		let repeatStop = 0;
		(function repeatBody() {
			getId(jsys.id).then((y)=> {
				console.log("y - ", y.values());
				if (y.values().length > 0) {
					repeatStop = 1;
					resolve(y.values()[0]);
				}
			}).catch((err)=> {
				console.log("Device error.. ", err);
			});
			count++;
			if (count > 10) {
				resolve(-1);
			}
			if (repeatStop === 0)
				setTimeout(repeatBody, 2000);
		})();
	});
}

if (jsys.type === "device") {
    let myindx = await getMyIndx();

    if (myindx < 0) {
		console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>> >>>>>>>>>>>> Process.. exiting....");
		process.exit(1);
	}

    console.log("My index... ", myindx);
}
