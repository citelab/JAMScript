
  const minicore = require('core/minicore');
  const jaminit = require('core/jaminit');
  const JAMCore = require('core/jamcore');

  
        const mbox = new Map();

        mbox.set("getCloudId", {func: "getCloudId", arg_sig: "x", side_eff: true, results: true, reuse: false, cond: "cloudonly"});
mbox.set("getId", {func: "getId", arg_sig: "x", side_eff: true, results: true, reuse: false, cond: "fogonly"});
mbox.set("driveNode", {func: "driveNode", arg_sig: "x,x,x", side_eff: true, results: false, reuse: false, cond: "devonly"});
        
  
  const conds = new Map();
  
  conds.set("cloudonly", {source: `jsys.type == 'cloud'`});
conds.set("fogonly", {source: `jsys.type == 'fog'`});
conds.set("devonly", {source: `jsys.type == 'device'`});
  

  async function launch()
  {
      minicore.init('./jamout.js', []);
      var ports = await minicore.run();
      var jsys = await jaminit.run();
      var jcore = new JAMCore(jsys, jaminit.reggie);
      jcore.registerFuncs(mbox);
      await jcore.run();
      jcore.addWorker(ports.app);
  }

  launch().then(()=> {
      console.log("Starting App..");
  });
  