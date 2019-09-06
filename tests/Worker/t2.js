const assert = require('assert');
const {
  Worker, MessageChannel, MessagePort, isMainThread, parentPort
} = require('worker_threads');
if (isMainThread) {
  const worker = new Worker(__filename);
  const subChannel = new MessageChannel();
    worker.postMessage({ hereIsYourPort: subChannel.port1 }, [subChannel.port1]);
    setInterval(function dd() {
	subChannel.port2.postMessage('xxxxxx');
    }, 300);
} else {
  parentPort.once('message', (value) => {
      assert(value.hereIsYourPort instanceof MessagePort);
      console.log("Hi..");
	  console.log("World...");
      value.hereIsYourPort.on('message', function(val) {
	  console.log("received: ", val);
      });
//    value.hereIsYourPort.close();
  });
}
