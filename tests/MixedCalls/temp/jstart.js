
  const minicore = require('core/minicore');
  const jaminit = require('core/jaminit');
  const JAMCore = require('core/jamcore');

  
        const mbox = new Map();

        mbox.set("getId", {func: "getId", arg_sig: "", side_eff: true, results: true, reuse: false, cond: "fogonly"});
        
  
  const conds = new Map();
  
  conds.set("fogonly", {source: `jsys.type == 'fog'`});
  

  async function launch()
  {
          console.log("------");
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
  