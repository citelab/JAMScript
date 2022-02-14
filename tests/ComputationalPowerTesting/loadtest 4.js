
function compute(len) {
    var i, x = 0;
    for (i = 0; i < len; i++) {
	    x += Math.tanh(i*1.5);
    }
}

const loadSize = 100000000;
var b = new Date();
compute(loadSize);
var e = new Date();

console.log(`Completed ${loadSize} computations in ${e-b} milliseconds.`)
