jdata {
  //cout is the inflow of progB
  cout as inflow of app://progB.outF;
  //shellOut is the outflow of the shell (from progB)
  shellOut as outflow of cout;

  char* selfName as broadcaster;

  //Job logger
  char* jobs as logger; //Job logger
  //TODO: This can be removed when device status is kept from the J Node instead
  struct nodeInfo {
    char* nodeName;
      char* nodeType;
      char* fog;
      char* cloud;
  } nodeInfo as logger; //Device info logger
}

var chance = require('chance').Chance();
var nodeName = chance.first();
console.log("Node name: " + nodeName);

jcond {
  namechk: selfName == nodeInfo.nodeName;
  cloudonly: sys.type == "cloud";
}

/**----------------REQUIRE-----------------------------------------**/
var shell = require('vorpal')();
var spawn = require('child_process').spawn;
var fs = require('fs');

/**----------------NODE INIT-----------------------------------------**/
var fogName;
var cloudName;
var outputFileName;

nodeInfo.addDatastream(nodeName);
jobs.addDatastream(nodeName);
var selfInfo = {"name": nodeName, "type": jsys.type};

/**----------------ADVERTISE SELF----------------------------------**/
jsys.ad_up('name',selfInfo)

jsys.ad_up_fogcback('name', function(x) {
  fogName = x;
});
jsys.ad_up_cloudcback('name', function(x) {
  cloudName = x;
});

/**----------------VARS--------------------------------------------**/
var jobList = [];

/**----------------JAMSCRIPT FUNCTIONS-----------------------------**/
jasync function changeDirectory(path) {
  process.chdir(path);
}

jasync {namechk} function displayHealth(node) {
  console.log("JCond broadcast is working!");
  console.log("If this prints, it means jcond succeeded and namechk = nodename");
}

jasync function getHealth(node) {
  selfName.broadcast(nodeName);
  console.log("Succesful broadcast");
  selfName.addHook(function(x) {
    console.log("Message: " + x.message);
  });
  //displayHealth(node);
}

jasync {cloudonly} function getAllNodes() {
  console.log("Cloud received node info command...");
  getNodeInfo();
}

/**----------------HELPER FUNCTIONS-------------------------------**/
/**
* Execute a program
*/
//runj progName.jxe --app=progName
function executeProgram(path) {
  console.log("Executing external JAMProgram...");
    var currPath = process.cwd();
    var progPath = process.cwd() + "/" + path;
    var progName = path.split("/").slice(-1)[0];
    console.log('Program to be executed: ' + progName);
    console.log('Changing directories to program path...');
    process.chdir(progPath);
    console.log('Spawning program...');
    var child = spawn('runj', [progName +'.jxe', '--app=' + progName]);
    var job = {name: progName, pid:child.pid};
    jobList.push(job);
    logJob(0,job);
    console.log("Pushed child: "+ child.pid + " to joblist");
    console.log('Returning to previous directory...');
    process.chdir(currPath);
    child.stdout.on('data',
      function (data) {
          console.log(''+ data);
    });
    execProg(progPath, progName);
}

/**
* Get node info from connected devices.
*/
var getNodeInfo = function(key,entry) {
  var i = 0;
  while(nodeInfo[i] !== undefined && !nodeInfo[i].isEmpty()) {
    console.log(nodeInfo[i].lastValue());
    i++;
  }
}

/**
* Logging utility for self-logging node-info
*/
function logNodeInfo(index, value){
    setTimeout(function() {
        nodeInfo[index].log(value, function (result) {
            if (!result.status)
                console.log(result.error);
        });
    }, 30);
}

function logJob(index, value) {
    setTimeout(function() {
        jobs[index].log(value, function (result) {
            if (!result.status)
                console.log('yyyy',result.error);
        });
    }, 30);
}

var getJobs = function(key,entry) {
  var i = 0;
  while(jobs[i] !== undefined && !jobs[i].isEmpty()) {
    console.log(jobs[i].lastValue());
    i++;
  }
}

/**
* Generate node info and log it
*/
function generateNodeInfo() {
  var val = {
    nodeName: nodeName,
    nodeType: jsys.type,
    fog: fogName,
    cloud: cloudName
  };
  logNodeInfo(0,val);
}

function listener(raw) {
  if(outputFileName == undefined) {
    console.log("Output file not specified...");
    return;
  }
  fs.writeFile(outputFileName, raw.data, function(err) {
    if(err) return console.log(err);
  });
}

function peek(raw) {
  console.log(raw.data);
}

/**----------------SPECIAL COMMANDS-------------------------------**/
shell
  .command('exec <progPath> [location] [locationNames...]', 'Execute a JAMProgram')
  .action(function(args, callback) {
    if(args.location == undefined) {
      executeProgram(args.progPath);
    }
    if(args.location !== undefined) {
      if(args.location == '@all') {
        console.log("Received @all exec command...Executing at all nodes");
      }
      if(args.location == '@fog') {
        console.log("Received @fog exec command...Executing at fog node");
      }
      if(args.location == '@device') {
        console.log("Received @device exec command...Executing at device node");
      }
      if(args.location == 'pipe') {
        console.log("Piping command received...Building pipe..");
        executeProgram(args.progPath);
        shellOut.start();
        executeProgram(args.locationNames[0]);
      }
      if(args.location == '>') {
        console.log("Output Redirection command received...");
        outputFileName = args. locationNames[0];
        executeProgram(args.progPath);
        var outRedirect = new OutFlow("redirectOut", cout);
        outRedirect.addChannel(listener);
      }
      // fileA => shell.inflow ==> shell.outflow ==> progD.inflow
      if(args.location == '<') {
        console.log("Input redirection command received...");
        executeProgram(args.progPath);
        var inputFilename = args.locationNames[0];
        // var fileInputFlow = Flow.from("fs://" + process.cwd() + "/" + inputFilename)
        //   .foreach((line) => console.log(line));
        var fileInputFlow = Flow.from("fs://" + process.cwd() + "/" + inputFilename)
        var shellFileOutflow = new OutFlow("shellFileOutflow", fileInputFlow);
        shellFileOutflow.addChannel(peek);
      }
    }
    callback();
  });

shell
  .command('nodes [location]', 'Displays node information')
  .action(function(args, callback) {
    if(args.location == undefined) {
      console.log("Displaying node info....");
      getNodeInfo();
    }
    if(args.location == 'all') {
      console.log("Displaying global node info....");
      getGlobalNodeInfo();
    }
    callback();
  });

shell
  .command('roots', 'Displays node hierarchy')
  .action(function(args, callback) {
    console.log("Displaying node hierarchy....");
    console.log("Cloud: ",  cloudName);
    console.log("Fog: ",  fogName);
    callback();
  });

shell
  .command('health <node>', 'Displays node health')
  .action(function(args, callback) {
    forwardHealthCommand(args.node);
    console.log("Displaying node health....");
    var nodeHealth = {
      uptime: Math.floor(process.uptime())
    };
    console.log(nodeHealth);
    callback();
  });

shell
  .command('jobs [node]', 'Displays jobs started')
  .action(function(args, callback) {
    console.log("Displaying jobs started....");
    getJobs();
    callback();
  });

/**----------------BUILT-IN COMMANDS-------------------------------**/
shell
  .command('jcd <path>', 'Change directories')
  .action(function(args, callback) {
    console.log("Received jcd command..Changing directories....");
    changeDirectory(args.path);
    callback();
  });

shell
  .command('jpwd', 'Print present directory')
  .action(function(args, callback) {
    console.log("Received jpwd command..printing directory....");
    console.log(process.cwd());
    callback();
  });

shell
  .command('jls', 'List directory')
  .action(function(args, callback) {
    console.log("Received jls command..listing directory....");
    fs.readdir(process.cwd(), (err, files) => {
        files.forEach(file => {
        console.log(file);
      });
    })
    callback();
  });

/**----------------CLEANUP-----------------------------------------**/
process.on('exit', (code) => {
    console.log('killing', jobList.length, 'child processes');
    jobList.forEach(function(job) {
      console.log('received', job.pid);
      process.kill(job.pid);
    });
    console.log('Exiting JAMShell...');
});

/**----------------SHELL INIT-------------------------------**/
generateNodeInfo();

shell
  .delimiter('>>')
  .show();
