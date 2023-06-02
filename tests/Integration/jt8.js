let count = 10;

jcond {
    fogonly: jsys.type == "fog";
    typeAonly: jsys.tag == "typeA";
}


setInterval(()=> {
    console.log("Calling answer me .... ", jsys.tags);
    console.log("Calling answer me .... ", jsys.long, jsys.lat);

    answerme("String -- " + count).catch((e)=> { console.log("Received... ", e)});
    count++;
}, 1000);


