
jcond {
    deviceOnly: jsys.type == "device";
    fogOnly: jsys.type == "fog";
}

let fcount = 10;
let scount = 10;
let count = 10;

jtask {fogOnly} function processMessage(str) {
    fcount++;
    console.log("First .. Processing the message ... ",  fcount, str);
    return fcount;
}

jtask* {fogOnly} function controllerFunc(str) {
    count++;
    console.log("Printing at the Controller... ", count, str);
}

jtask {deviceOnly} function anotherProcessMsg(str) {
    scount++;
    console.log("First .. Processing the message ... ",  scount, str);
    return scount;
}

setInterval(()=> {
    console.log("This is a loop at the controller.", jsys.tags);
    controllerFunc("hello, from controller").catch((e)=>{
        console.log("calling ControllerFunc at " + jsys.type + " has an Error: " + e);
    });
}, 1000);