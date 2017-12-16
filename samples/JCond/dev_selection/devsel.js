jdata {
    char *x as broadcaster;
    char *id as logger;
}


jcond {
    fogonly: sys.type == "fog";
    devonly: sys.type == "device";
    matchid: x == id;
}

var idlogger = id.getMyDataStream();
var machids = [];
// Lets start ids at 1000
var fidcounter = 1000;


// This is the ID issuer at the Fog.
// This cannot be called using J-J because in
// JAMScript J-J is always downstream.
// So.. we call this through a C proxy function
//
jsync {devonly} function getMyId() {
    console.log("getMyId called....");
    machids.push(fidcounter);
    return fidcounter++;
}

var myid = 0;
var gotmyid = false;



function putIdCback(msg) {

    gotmyid = true;
    if (msg !== undefined && msg !== "")
        myid = msg;
    idlogger.log(myid, function (err) {
        console.log("Error logging id", err);
    });
}


jasync {devonly} function askforId() {
    if (!gotmyid) {
        // Don't ask if another Id if you have already gotten one..
        // Check logger first!
        // if (idlogger !== undefined && idlogger.lastValue() !== undefined) {
        //     myid = idlogger.lastValue();
        //     gotmyid = true;
        //     return;
        // }
        console.log("Asking for Id");
        call_get_myid("asking for id", putIdCback);
    }
}


// Run the worker function only at the selected device
// The device selection is done by the fog.
// The fog is broadcasting the ID it wants to pick
//
jasync {devonly && matchid} function runAtDevice() {
    console.log("Running at the device J..with ID = ", myid);
    console.log("Type ", jsys.type);
}


// This is the function that is trying to launch work
// on A device J. We have all the deviceJs in machids[] array.
// We could add more persistence to this example by
// using the logger!
//
jasync {fogonly} function callMyDevice() {

    if (machids.length > 0) {
        console.log("Calling my device...");
        // Select the ID of the device to run
        x.broadcast(1000);
        runAtDevice();
    } else {
        console.log("No device registered at the cloud...");
    }
}

// Main event loop at the J
// J is doing something every 1 sec.
setInterval(function() {
    console.log("Running J... ");
    if (!gotmyid)
        askforId();
    else {
        console.log("My id ..", myid);
    }
    callMyDevice();

}, 1000);
