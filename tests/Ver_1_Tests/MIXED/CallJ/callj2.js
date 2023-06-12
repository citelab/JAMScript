
var i = 100;

jasync function callingj(x) {
    console.log("Value of x ", x);
}

setInterval(function inner() {
    console.log("Calling.. C side ");
    testfunc("i = " + i);
    i += 10;
}, 500);
