jcond {
    fogonly: sys.type == "fog";
    devonly: sys.type == "device";
}

var machids = [];

var fidcounter = 1;

jsync {fogonly} function getMyId() {
    console.log("Issuing id : ", fidcounter);
    return fidcounter++;
}

jasync {devonly} function askforId() {
    console.log("Asking for Id");

    
}





setTimeout(function() {
	console.log("Running C init..");
	docinit();
}, 5000);


