
jsync function getid() {
    console.log("Returning.. ", fogcnt);

//    loadme(25000000);    gives about 100 ms delay
//  loadme(100000000); gives about 400 ms delay

    if ((ii < 10) || (ii > 20)) {
        console.log("Low delay...");
        loadme(25000000);
    } else {
        console.log("High delauy...");
        loadme(100000000);
    }
    ii++;

    return fogcnt++;
}

function loadme(len) {
    var i, x = 0;
    for (i = 0; i < len; i++) {
	    x += Math.tanh(i*1.5);
    }
}


var fogcnt = 10;
var ii = 1;

setInterval(function() {
    console.log("This is just a local print...");
}, 300);
