var jamlib = require('./jamlib');
var jnode = require('./jnode');

var mbox = {
    "functions": {
        "testfunc": function testfunc(arg) {console.log("########## Printing from testfunc  ", arg); },
        "hellofunc": function hellofunc(arg) {console.log("##############Printing from hellofunc ", arg); },
        "resultfunc": function resultfunc(arg) {console.log("#################Print from result func  ", arg);}
    },
    "signatures": {
        "testfunc": "s",
        "hellofunc": "s",
        "resultfunc": "s"
    }
}

jamlib.registerFuncs(mbox);
jamlib.run(function () {
    console.log("Running the function.....");
    jnode.machAsyncExec("testfunc", ["hello2"], "true");
});
