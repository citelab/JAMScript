
jdata {
    char *x as logger;
    char *y as broadcaster;
}

jcond {
    namecheck: x == y;
    cloudonly: sys.type == "cloud";
}

jasync {namecheck} function runTheProc(name) {
    console.log("========= FOUND The " + name + "! ================");
}


jasync {cloudonly} function runAtCloud() {

    console.log("Running at the cloud...");
    y.broadcast("bucks");
    runTheProc("bucks");

}

var xlogger = x.getMyDataStream();
var q = Math.random();
setInterval(()=> {
    runAtCloud();

    if (q < 0.3)
        xlogger.log("bucks");
    else if (q < 0.6)
        xlogger.log("bucks");
    else if (q < 0.9)
        xlogger.log("bucks");
    else
        xlogger.log("raptors");

    console.log("Logged value ", xlogger.lastValue());
    console.log("Broadcasted value ", y.getLastValue());

}, 1000);
