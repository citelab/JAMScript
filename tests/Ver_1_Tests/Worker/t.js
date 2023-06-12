const { Worker, isMainThread, parentPort, MessageChannel } = require('worker_threads');

if (isMainThread) {
    const worker = new Worker(__filename);

    const {port1, port2} = new MessageChannel();

    worker.postMessage([], port2);

    setInterval(function() {
	port1.postMessage('Hello, world!');
    }, 300);
} else {
  // When a message from the parent thread is received, send it back:
    parentPort.once('message', (message) => {
	console.log(message);
  });
}
