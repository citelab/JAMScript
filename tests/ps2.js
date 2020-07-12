var iter = 0;
var id = 0;

// NEED TO SET THIS UP DYNAMICALLY
var numWorkers = 3;
var workersReady = [1, 1, 1];

jasync function printamsg(x) {
    console.log("Got a message from the worker ", x);
}

jsync function getID() {
    // if(id == 0){
    //     id++;
    //     return 0;
    // }
    
    // id++;
    return id++;
}

// function to initialize stuff at the beginning
// setTimeout(function(){
//     // workersReady = new Array(numWorkers); // This seems disfunctional
//     workersReady = [0, 0, 0];
//     for(var i = 0; i < numWorkers; i++) {
//         workersReady[i] = 1;
//     }
//     console.log("Initialized the workers' array.");
// }, 0)

var rv;

setInterval(function() {
    
    if(!isNextWave()) {
        return;
    }
    //workersReady = [0, 0, 0];

    console.log("Calling a synchronous function... in C side");
    rv = runatsametime(iter);
    iter++;
    console.log("Returns ", rv);
    //console.log("Worker's Readiness : ", workersReady[0], workersReady[1], workersReady[2]);
}, 5000);

// ------ sync functions ------ //

jsync function wReady(x) {
//    workersReady[x] = 1;
    //    return workersReady[x];
    return 1;
}

function isNextWave() {
    var isReady = true;
    for(var i = 0; i < numWorkers; i++) {
        if(workersReady[i] == 0) {
            isReady = false;
        }
    }
    return isReady;
}
