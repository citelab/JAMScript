jcond {
    fogonly: jsys.type == "fog";
}


var count = 1;

jsync {fogonly} function getId() {
    console.log("Creating an ID.. ", count);
    return count++;
}
