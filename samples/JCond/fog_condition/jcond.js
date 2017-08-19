jcond {
    fogonly: sys.type == "fog";
}

jasync {fogonly} function pong() {
    console.log("pong......");
}

setInterval(()=> {
    pong();

}, 2000);


