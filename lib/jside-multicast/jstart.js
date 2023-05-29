const minicore = require('./core/minicore');
const jaminit = require('./core/jaminit');
const JAMCore = require('./core/jamcore');

var mbox = new Map();
mbox.set("me", {func: "callme", arg_sig: "ssi", side_eff: true, results: true, reuse: false, cond: ""});
mbox.set("you", {func: "callyou", arg_sig: "ii", side_eff: true, results: true, reuse: false, cond: "deviceonly"});
mbox.set("testrv", {func: "calltestrv", arg_sig: "id", side_eff: true, results: true, reuse: false, cond: "fogonly"});

var  conds = new Map();
conds.set("deviceonly", 'jsys.type == "device"');
conds.set("fogonly", 'jsys.type == "fog"');

async function launch()
{
    minicore.init('./jamout.js', './testsched.js', []);
    var ports = await minicore.run();
    var jsys = await jaminit.run();
    var jcore = new JAMCore(jsys);
    jcore.registerFuncs(mbox);
    await jcore.run();
    jcore.addWorker(ports.app);
}

launch().then(()=> {
    console.log("App Launch success.");
}).catch((e)=> {
    console.log("App Launch failed: ", e);
});