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

async function getMyCloudId(uid) {
    while(1) {
		let a = getCloudId(uid);
		try {
			let x = await a.next();
			await a.return();
			return x.value;
		} catch (e) {
			console.log("Error calling getCloudId().. ", e.message);
			await a.return();
		}
	}
}


jtask {fogonly} function getId(uid) {

    console.log("Calling getMyCloudId...");
    let mygid = getMyCloudId(uid);
    resolve(mygid);
}

async function getMyIndx() {
    while(1) {
		let a = getId(jsys.id);
		try {
			let x = await a.next();
			await a.return();
			return x.value;
		} catch (e) {
			console.log("Error calling getId().. ", e.message);
			await a.return();
		}
    }
}

if (jsys.type === "device") {
    let myindx = await getMyIndx();
    console.log("My index... ", myindx);
    process.exit(0);
}
