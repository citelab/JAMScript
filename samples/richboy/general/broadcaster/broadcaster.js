jdata {
    char* x as logger;
    char* y as broadcaster;
}

jcond {
    cloudonly: sys.type == "cloud";
    notcloud: sys.type != "cloud";
}

jasync {cloudonly} function runAtCloud() {
    console.log("Running at the cloud...");
    y.broadcast("something");
}

jasync {notcloud} function runElsewhere() {
    console.log('last value is ', y.getLastValue());
}

setInterval(function(){
    //console.log('Broadcast domain: ', y.getDomain());
    runAtCloud();
    runElsewhere();
}, 1000);