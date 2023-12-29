
  const minicore = require('core/minicore');
  const jaminit = require('core/jaminit');
  const JAMCore = require('core/jamcore');

  
        const mbox = new Map();

        mbox.set("answerme_ctl", {func: "answerme_ctl", arg_sig: "x,x,x,x", side_eff: true, results: false, reuse: false, cond: ""});
        
  
  const conds = new Map();
  
  conds.set("fogonly", {source: `jsys.type == 'fog'`});
conds.set("typeAonly", {source: `jsys.tag == 'typeA'`});
  

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
  