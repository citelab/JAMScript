
function loadme(len) {
    var i, x = 0;
    for (i = 0; i < len; i++) {
	x += Math.tanh(i*1.5);
    }
}

var b = new Date();
loadme(100000000);
var e = new Date();
console.log(e-b);
