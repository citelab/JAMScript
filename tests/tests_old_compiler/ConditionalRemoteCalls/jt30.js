
jcond {
    deviceOnly: jsys.type == "device";
    fogOnly: jsys.type == "fog";
}

let fcount = 10;
let scount = 10;

jtask* {fogOnly} function processMessage(str) {
    fcount++;
    console.log("First .. Processing the message ... ",  fcount, str);
}

jtask* {deviceOnly} function anotherProcessMsg(str) {
    scount++;
    console.log("First .. Processing the message ... ",  scount, str);
}

setInterval(()=> {
    console.log("This is a loop at the controller.");
}, 1000);