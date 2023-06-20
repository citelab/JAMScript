let count = 0;


function buggy(anything) {
    console.log("Why doesn't this work" + anything);
}

//function assert(condE){if(!condE){let _err = new Error(); console.log("ToasterAssert#{${_err.stack}}#");}}

//function coverage(_id){console.log("ToasterCoverage#{${_id}}#");}



jtask* function you(str) {
    //assert(12==13);
    count++;
    console.log("Message received: ", str, " local count ", count);
    //coverage();
    testing("helllloooo");
}

setInterval(()=> {
    console.log("hello.. main loop ");
}, 1000);
