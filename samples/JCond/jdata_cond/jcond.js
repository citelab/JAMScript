jdata {
    int x as logger;
    int y as broadcaster;
}

jcond {
    numcheck: x == y;

}

jasync {numcheck} function pong() {
    console.log("================ Pong!");
}

/*
jasync {cloudonly} function pong2() {
    console.log("In pong2..");
    pong();
}


jasync {devonly} function pong3() {
    console.log("pong......");
}
*/

setInterval(()=> {
   console.log("Calling pong...");
   pong2();

}, 2000);
