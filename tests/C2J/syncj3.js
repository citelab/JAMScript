jcond {
    fogonly: jsys.type == "fog";
    devonly: jsys.type == "device";
    cloudonly: jsys.type == "cloud";
}


jsync {fogonly} function getfogid() {
    console.log("Returning.. ", fogcnt);
    return fogcnt++;
}

jsync {cloudonly} function getcloudid() {
    console.log("Returning.. ", cloudcnt);
    return cloudcnt++;
}

jsync {devonly} function getdevid() {
    console.log("Returning.. ", devcnt);
    return devcnt++;
}


var fogcnt = 10,
    cloudcnt = 1000,
    devcnt = 10000;

setInterval(function() {
    console.log("This is just a local print...");
}, 300);
