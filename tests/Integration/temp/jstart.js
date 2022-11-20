
  const minicore = require('core/minicore');
  const jaminit = require('core/jaminit');
  const JAMCore = require('core/jamcore');

  
        const mbox = new Map();

        mbox.set("compyou", {func: "compyou", arg_sig: "x", side_eff: true, results: false, reuse: false, cond: ""});
        
  
  const conds = new Map();
  
  
  

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
  