
  const minicore = require('core/minicore');
  const jaminit = require('core/jaminit');
  const JAMCore = require('core/jamcore');

  
        const mbox = new Map();

        mbox.set("compyou", {func: "compyou", arg_sig: "x", side_eff: true, results: true, reuse: false, cond: "fogonly"});
        
  
  const conds = new Map();
  
  conds.set("fogonly", {source: `jsys.type == 'fog'`});
conds.set("typeAonly", {source: `jsys.tag == 'typeA'`});
  

  async function launch()
  {
      minicore.init('./jamout.js', './dummysched.js', []);
      var ports = await minicore.run();
      var jsys = await jaminit.run();
      var jcore = new JAMCore(jsys);
      jcore.registerFuncs(mbox);
      await jcore.run();
      jcore.addWorker(ports.app);
  }

  launch().then(()=> {
      console.log("Starting App..");
  });
  