jdata {
    int x as logger;
    int y as broadcaster;
    float q as logger;
    float q2 as logger;
}

jcond {
    cloudonly: sys.type == "cloud";
    devonly: sys.type == "device";
    numchek: x == y;
    numch: q == 10;
    numcheck: x == y;
    numc: max(q2.yy) == y;
	
}

jasync {numcheck} function pong() {
    console.log("================ Pong!");
}

jasync {cloudonly} function pong2() {
    console.log("In pong2..");
    pong();
}


jasync {devonly} function pong3() {
    console.log("pong......");
}

setInterval(()=> {
   console.log("Calling pong...");
   pong2();

}, 2000);
