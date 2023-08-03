
jdata {
  struct __xx {
    int yy;
    double zz;
  } zzz as uflow;
  int qq as uflow;
  int ppp as uflow;
  char* qqqq as uflow;
  float xxxx as uflow;
  double yyy as uflow;
}

var count = 0;

async function getloop() {
  let x;
  while(true) {
    x = await ppp.readLast();
    count++;
  }
}

setInterval(()=>{
  console.log("Received: "+count);
  count = 0;
}, 1000);

console.log("I am in the device J .. expecting data from the C workers.");
await getloop();
