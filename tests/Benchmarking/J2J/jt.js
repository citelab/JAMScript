// @ToasterConfig
// Fogs: 1

jcond {
    fogonly: jsys.type == "fog";
}


var counter = 0;

jtask* {fogonly} function remoteCall(test) {
  counter += 1;
}

function doCall() {
  remoteCall().catch((e)=>{});
  setImmediate(doCall);
}

setImmediate(doCall);

setInterval(() => {
  console.log("Counter: " + counter);
  counter = 0;
}, 1000);

