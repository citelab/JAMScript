// @ToasterConfig
// Fogs: 1

jcond {
    fogonly: jsys.type == "fog";
}


var counter = 0;

jtask function remoteCall(test) {
    counter += 1;
    resolve(counter);
}

if (jsys.type === 'device') {
    setInterval(() => {
	let tx = "time for j call ";
	console.time(tx);
	remoteCall('test msg').then((x)=> { console.timeEnd(tx); }).catch(()=> {});
    }, 1000);
}

