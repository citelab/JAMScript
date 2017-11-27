var counter = 0;
var pecnt = 1;

jasync function ping(penum) {
    counter = counter + 1;
    console.log("ping received from PE:", penum, " count ", counter);
    pong();
}

jasync function regme(msg, cback) {
    
    console.log("registration received from ", msg);
    cback('' + pecnt);
    pecnt++;
}
