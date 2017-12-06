
jdata {
    int x as logger;
    int y as broadcaster;
    int z as broadcaster;
}

jcond {
    numcheck: y < 15 && z > 2, notequal;
    check2: max(x) < y, notequal;
}

jasync {numcheck} function pong() {
    console.log("================ Pong!");
}

var count = 0;
var indx = 0;

setInterval(()=> {
   y.broadcast(count);
   z.broadcast(indx);
   console.log("Calling pong...count = ", count++, " indx = ", indx++);
   pong();

}, 2000);


function notequal() {

	return;
}
