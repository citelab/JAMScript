
jdata {
    int x as logger;
    int y as broadcaster;
    int z as broadcaster;
}

jcond {
    numcheck: y < 15 && z > 2, notequal;
}

jasync {numcheck} function pong() {
    console.log("================ Pong!");
}

var count = 10;

setInterval(()=> {
   y.broadcast(count++);
   z.broadcast(count++ -11);
   console.log("Calling pong...");
   pong();

}, 2000);


function notequal() {

	return;
}
