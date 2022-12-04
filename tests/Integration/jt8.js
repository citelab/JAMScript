let count = 10;

jcond {
    fogonly: jsys.type == "fog";
    typeAonly: jsys.tag == "typeA";
}


setInterval(()=> {
    console.log("Calling answer me .... ");
    answerme("String -- " + count).catch((e)=> { console.log("Received... ", e)});
    count++;
}, 1000);


