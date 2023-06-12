
var x = 100;

jasync function callother(y) {
    console.log("This is called... ", y);
}


setInterval(()=> {
    console.log("Calling another J.. ");
    if (jsys.type == "device" && jsys.tags == "nodeA")
	callother(x);
    x++;
}, 500);
