
const {Worker, MessagePort, MessageChannel, isMainThread, parentPort} = require('worker_threads');
i = 1;

if (isMainThread) {
    const worker = new Worker(__filename);
    const subChannel = new MessageChannel();
    worker.postMessage({ hereIsYourPort: subChannel.port1 },
		       [subChannel.port1]);
    setInterval(function callwork() {
	console.log("Calling work... ");
	subChannel.port2.postMessage(i);
	i++;
    }, 300);

} else {

    parentPort.once('message' , function(val) {
	val.hereIsYourPort.on('message', function(v) {
	    console.log("Actual work launched..", v);
	    actualWork();
	    console.log("ffffffff");
	});
    });    
}



function actualWork() {
    console.log("Doing work...")
    for (i = 0; i < 5000000; i++) {

	k = i/10000.0;
	j = i * Math.tan(k);
    }
        console.log("Done work...")
}
