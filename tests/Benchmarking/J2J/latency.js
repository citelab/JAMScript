// @ToasterConfig
// Devices: 1
// Fogs: 1

jcond {
  fogonly: jsys.type == "fog";
  deviceonly: jsys.type == "device";
}

let process = require('process');

var counter = 0;
var accumulator = 0;

async function sleep(timeout) {
  return await new Promise((resolve)=>{
    setTimeout(()=>{
      resolve();
    }, timeout);
  });
}

jtask {fogonly} function remoteCall(test) {
//  counter += 1;
  //await sleep(1000);
  
  let res = 1;
  
  /*for(var i = 1; i < 1000*1000; i++) {
    res += i;
    res -= (i)/4 * (test % 50)/12;
  }*/
  
  return res;
}

async function doCall() {
  var start, end;
  try {
    
    start = process.hrtime.bigint();
    await remoteCall(counter);
    end = process.hrtime.bigint();
    
    accumulator += Number(end-start)
    counter++;
    
    //console.log("EEEEE", accumulator);
  } catch(e) {
    // OOOPSIES
    console.log("BAD!!!!!");
  }
  setImmediate(doCall);
}

if(jsys.type == "device") {
  setImmediate(doCall);

  setInterval(() => {
    console.log("Average Round Trip Latency: ",  accumulator/counter);
    counter = 0;
    accumulator = 0;
  }, 1000);

}
