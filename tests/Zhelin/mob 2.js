// Run program: jamrun mob.jxe --app=mobDemo1 --loc=20,0 --fog
// jamrun mob.jxe --app=mobDemo1 --loc=40,0 --fog
// jamrun mob.jxe --app=mobDemo1 --link=near --num=4

jdata {
    int y as logger;
}

var iteration = 1;

if (jsys.type == "fog") {
    setInterval(() => {
        console.log("==========\nResults from Iteration", iteration, ":");
        console.log("Total number of worker participated:", y.size());
        console.log("Results:");
        for (var i = 0; i < y.size(); i ++) {
            console.log(y[i].lastValue());
        }
        iteration ++;
    },3000);
} else {
    // Simulate device movement by setting device longitude to random numbers
    setInterval(() => {
        jsys.setLong(Math.random() * 60);
    }, 3300)
}