var counter = 0;

jasync remoteCall(test: int) {
  counter += 1;
}


let iteration = 0;
let mincnt = 10000000;
let maxcnt = 0;

setInterval(() => {
    iteration++;
    console.log("Counter: " + counter, " max cnt ", maxcnt, " min cnt ", mincnt);
    if (iteration > 10) {
	if (mincnt > counter)
	    mincnt = counter;
	if (maxcnt < counter)
	    maxcnt = counter;
    }
    
    counter = 0;
}, 1000);
