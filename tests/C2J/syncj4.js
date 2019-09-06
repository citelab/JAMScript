jcond {
    fogonly: jsys.type == "fog";
    devonly: jsys.type == "device";
}


jsync {fogonly} function getfogid() {
    console.log("Returning.. ", fogcnt);
//    setTimeout(()=> {
        return fogcnt++;
//    }, 1000);
}

jsync {devonly} function getdevid() {
    console.log("Returning.. ", cloudcnt);
//    setTimeout(()=> {
        return cloudcnt++;
//    }, 2000);
}

var fogcnt = 10,
    cloudcnt = 1000;

setInterval(function() {
    console.log("This is just a local print...");
}, 3000);
