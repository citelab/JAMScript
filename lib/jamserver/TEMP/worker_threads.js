
const {Worker, MessagePort, MessageChannel, isMainThread, parentPort, threadId} = require('worker_threads');
i = 1;

var queue = new Array();
var sendPort = null;
var busy = false;

function enqueueWork(j) {

    if (busy)
	queue.push(j);
    else {
	if (sendPort !== null)
	    sendPort.postMessage(j);
	busy = true;
    }
}


if (isMainThread) {
    const worker = new Worker(__filename);
    const subChannel = new MessageChannel();
    worker.postMessage({ hereIsYourPort: subChannel.port1},
		       [subChannel.port1]);
    sendPort = subChannel.port2;

    sendPort.on('message', function(val) {
	busy = false;

    console.log("---> ", val);

	if (queue.length > 0) {
	    busy = true;
	    sendPort.postMessage(queue.shift());
	}
    });

    var inter = setInterval(function callwork() {
	console.log("Enqueuing work... ", i);
	enqueueWork(i);
	i++;
	if (i > 200)
	    clearInterval(inter);
    }, 50);

} else {

    parentPort.once('message' , function(val) {
	val.hereIsYourPort.on('message', function(v) {
	    console.log("starting... work .....................", v);
	    actualWork();
	    val.hereIsYourPort.postMessage("xxdone");
	});
    });

}


function actualWork() {

    for (q = 0; q < 5000000; q++) {
	m = Math.random();
	j = q * Math.tan(m);
    }
}
