jcond {
    fogonly: jsys.type == "fog";
    devonly: jsys.type == "device";
}

var count = 1;

jasync {fogonly} function runatfog(q) {

    console.log("At fog only...", q);
    runatdev(count);
    count++;
}

jasync {devonly} function runatdev(q) {
    console.log("At dev only..", q);
    worker(q);
}

