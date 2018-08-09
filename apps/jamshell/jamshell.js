jdata {
  char* execTargetId as broadcaster;
  char* jobsLogger as logger;
}

jobsLogger.findAllStreams();

jcond {
  cloudOnly: jsys.type == "cloud";
  fogOnly: jsys.type == "fog";
  targetFogFromCloud: jsys.type == "fog" && execTargetId == jsys.id;
  targetDeviceFromCloud: jsys.type == "device" && execTargetId == jsys.id;
  targetDeviceFromFog: jsys.type == "device" && execTargetId == jsys.id, targetDeviceFromFogCallback;
}

var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var Random = require('random-js');
var vorpal = require('vorpal')();
var config = require('./config/default');

// identifier generator (flowId, jobId, and taskId)
var random = new Random(Random.engines.mt19937().autoSeed());

// generates a unique flow identifier (flowId)
function getFlowId() {
  return random.uuid4();
}

// generates a unique job identifier (jobId)
function getJobId() {
  return random.uuid4();
}

// generates a unique task identifier (taskId)
function getTaskId() {
  return random.uuid4();
}

// map from node (identified by nodeId) to tasks (identified by taskId)
// submitted by that node for execution on the current node
var tasks = new Map();

// checks whether a task is executed
function isTaskExecuted(nodeId, taskId) {
  var nodeTasks = tasks.get(nodeId);
  if (nodeTasks == undefined) {
    // first task submitted
    nodeTasks = new Set();
    tasks.set(nodeId, nodeTasks);
  }
  if (nodeTasks.has(taskId)) {
    // task already executed
    return true;
  }
  nodeTasks.add(taskId);
  return false;
}

// file extension of compiled JAMScript program
var JAMSCRIPT_PROG_EXT = '.jxe';

// checks whether a path identifies a JAMScript program
function isJAMScriptProgram(path) {
  return path.endsWith(JAMSCRIPT_PROG_EXT);
}

// directory in which the shell is located
var JAMSHELL_HOME = process.cwd();

// path to file-to-flow utility
var FILE_TO_FLOW_PROG_PATH = JAMSHELL_HOME + '/utils/file2flow' + JAMSCRIPT_PROG_EXT;

// path to flow-to-file utility
var FLOW_TO_FILE_PROG_PATH = JAMSHELL_HOME + '/utils/flow2file' + JAMSCRIPT_PROG_EXT;

// list of JAMScript programs spawned by the shell
// each job is identified locally by its process group ID (PGID)
// jobs belonging to the same application tree are identified globally by the same jobId
var jobs = [];

// data stream for jobs logged by the current node
var jobsDataStream = jobsLogger.getMyDataStream();

// logs the current node's jobs
function logJobs() {
  jobsDataStream.log(JSON.stringify(jobs));
}

// returns all jobs logged on the current node
function getMyJobsLogged() {
  var lastValue = jobsDataStream.lastValue();
  return (lastValue != null) ? JSON.parse(lastValue) : [];
}

// returns all jobs logged in the current node's subtree
function getJobsLogged() {
  var jobsLogged = [];
  var numDataStreams = jobsLogger.size();
  for (var i = 0; i < numDataStreams; i++) {
    var dataStream = jobsLogger[i];
    var nodeInfo = dataStream.dev_id.split('_');
    var lastValue = dataStream.lastValue();
    if (lastValue != null) {
      var _jobs = JSON.parse(lastValue);
      for (var j = 0; j < _jobs.length; j++) {
        var _job = _jobs[j];
        jobsLogged.push({
          nodeType: nodeInfo[1],
          nodeId: nodeInfo[0],
          jobId: _job.id,
          app: _job.app
        });
      }
    }
  }
  return jobsLogged;
}

// compares two jobs logged by nodeType, nodeId, app, and jobId in this order
function compareJobsLogged(job1, job2) {
  if (job1.nodeType == 'cloud' && job2.nodeType != 'cloud') return -1;
  if (job2.nodeType == 'cloud' && job1.nodeType != 'cloud') return 1;
  if (job1.nodeType == 'fog' && job2.nodeType != 'fog') return -1;
  if (job2.nodeType == 'fog' && job1.nodeType != 'fog') return 1;

  if (job1.nodeId < job2.nodeId) return -1;
  if (job2.nodeId < job1.nodeId) return 1;

  if (job1.app < job2.app) return -1;
  if (job2.app < job1.app) return 1;

  if (job1.jobId < job2.jobId) return -1;
  if (job2.jobId < job1.jobId) return 1;

  return 0;
}

// kills the specified job on the current node
function killJob(path) {
  var index = path.indexOf('/');
  var id = path.substring(index + 1);
  var idType = path.substring(0, index);
  var unique = idType == 'id';
  var killed = false;
  for (var i = jobs.length - 1; i >= 0; i--) {
    var job = jobs[i];
    if (job[idType] == id) {
      try {
        process.kill(-job.pgid);
      } catch (e) {
        // job already terminated
      }
      jobs.splice(i, 1);
      killed = true;
      if (unique) break;
    }
  }
  if (killed) logJobs();
}

// executes a compiled JAMScript program in the current node's subtree
jasync function execProg(progPath, inFlowId, outFlowId, jobId) {
  if (progPath.startsWith(JAMSHELL_HOME + '/killJob/')) {
    killJob(progPath.substring(JAMSHELL_HOME.length + '/killJob/'.length));
  } else {
    var app = path.basename(progPath, JAMSCRIPT_PROG_EXT);
    var args = [progPath, '--app=' + app, '--port=' + jsys.getMQTT().port];
    var redis = jsys.getRedis();
    if (redis) args.push('--data=' + redis.host + ':' + redis.port);
    if (inFlowId) args.push('--iflow=' + inFlowId);
    if (outFlowId) args.push('--oflow=' + outFlowId);
    if (jsys.type != 'device') args.push('--' + jsys.type);
    var options = {detached: true}; // new process group
    var child = child_process.spawn('jamexec', args, options);
    jobs.push({pgid: child.pid, id: jobId, app: app});
    logJobs();
  }
}

// called from the cloud to execute a program in the target node's subtree
function execProgCloud(progPath, inFlowId, outFlowId, targetType, targetId) {
  switch (targetType) {
    case 'device':
      execTargetId.broadcast(targetId);
      execProgTargetDeviceFromCloud(progPath, inFlowId, outFlowId);
      break;
    case 'fog':
      execTargetId.broadcast(targetId);
      execProgTargetFogFromCloud(progPath, inFlowId, outFlowId);
      break;
    case 'cloud':
      execProg(progPath, inFlowId, outFlowId, getJobId());
      break;
    default:
      // invalid targetType
      break;
  }
}

// called from a fog to execute a program in the target node's subtree
jasync {cloudOnly} function execProgCloudFromFog(progPath, inFlowId, outFlowId, targetType, targetId, nodeId, taskId) {
  if (!isTaskExecuted(nodeId, taskId)) {
    execProgCloud(progPath, inFlowId, outFlowId, targetType, targetId);
  }
}

// called from a device to execute a program in the target node's subtree
jasync {cloudOnly} function execProgCloudFromDevice(progPath, inFlowId, outFlowId, targetType, targetId) {
  execProgCloud(progPath, inFlowId, outFlowId, targetType, targetId);
}

// called from a device to execute a program in the target node's subtree
jasync {fogOnly} function execProgFogFromDevice(progPath, inFlowId, outFlowId, targetType, targetId) {
  switch (targetType) {
    case 'device':
      execTargetId.broadcast(targetId);
      execProgTargetDeviceFromFog(progPath, inFlowId, outFlowId, targetId);
      break;
    case 'fog':
      if (!targetId || targetId == jsys.id) {
        execProg(progPath, inFlowId, outFlowId, getJobId());
      } else {
        exec_prog_cloud_from_fog(progPath, inFlowId, outFlowId, 'fog', targetId, jsys.id, getTaskId());
      }
      break;
    default:
      // invalid targetType
      break;
  }
}

// called from the cloud to execute a program in the target fog's subtree
jasync {targetFogFromCloud} function execProgTargetFogFromCloud(progPath, inFlowId, outFlowId) {
  execProg(progPath, inFlowId, outFlowId, getJobId());
}

// called from the cloud to execute a program on the target device
jasync {targetDeviceFromCloud} function execProgTargetDeviceFromCloud(progPath, inFlowId, outFlowId) {
  execProg(progPath, inFlowId, outFlowId, getJobId());
}

// called from a fog to execute a program on the target device which is in its subtree
jasync {targetDeviceFromFog} function execProgTargetDeviceFromFog(progPath, inFlowId, outFlowId, targetId) {
  execProg(progPath, inFlowId, outFlowId, getJobId());
}

// called from a fog to execute a program on the target device which is not in its subtree
function targetDeviceFromFogCallback(params) {
  var progPath = params[0];
  var inFlowId = params[1];
  var outFlowId = params[2];
  var targetId = params[3];
  exec_prog_cloud_from_fog(progPath, inFlowId, outFlowId, 'device', targetId, jsys.id, getTaskId());
}

// exec prog.jxe @cloud
function handleExecProgCloud(progPath, inFlowId, outFlowId) {
  switch (jsys.type) {
    case 'device':
      exec_prog_cloud_from_device(progPath, inFlowId, outFlowId, 'cloud', '');
      break;
    case 'fog':
      exec_prog_cloud_from_fog(progPath, inFlowId, outFlowId, 'cloud', '', jsys.id, getTaskId());
      break;
    case 'cloud':
      execProg(progPath, inFlowId, outFlowId, getJobId());
      break;
    default:
      throw new Error('invalid jsys.type: ' + jsys.type);
  }
}

// exec prog.jxe @fog [X]
function handleExecProgFog(progPath, inFlowId, outFlowId, targetId) {
  if (!targetId) {
    switch (jsys.type) {
      case 'device':
        exec_prog_fog_from_device(progPath, inFlowId, outFlowId, 'fog', '');
        break;
      case 'fog':
        execProg(progPath, inFlowId, outFlowId, getJobId());
        break;
      default:
        throw new Error('invalid jsys.type: ' + jsys.type);
    }
  } else {
    switch (jsys.type) {
      case 'device':
        exec_prog_fog_from_device(progPath, inFlowId, outFlowId, 'fog', targetId);
        break;
      case 'fog':
        if (targetId == jsys.id) {
          execProg(progPath, inFlowId, outFlowId, getJobId());
        } else {
          exec_prog_cloud_from_fog(progPath, inFlowId, outFlowId, 'fog', targetId, jsys.id, getTaskId());
        }
        break;
      case 'cloud':
        execTargetId.broadcast(targetId);
        execProgTargetFogFromCloud(progPath, inFlowId, outFlowId);
        break;
      default:
        throw new Error('invalid jsys.type: ' + jsys.type);
    }
  }
}

// exec prog.jxe @device X
function handleExecProgDevice(progPath, inFlowId, outFlowId, targetId) {
  if (!targetId) {
    throw new Error('targetId must be specified');
  }

  switch (jsys.type) {
    case 'device':
      if (targetId == jsys.id) {
        execProg(progPath, inFlowId, outFlowId, getJobId());
      } else {
        exec_prog_fog_from_device(progPath, inFlowId, outFlowId, 'device', targetId);
      }
      break;
    case 'fog':
      execTargetId.broadcast(targetId);
      execProgTargetDeviceFromFog(progPath, inFlowId, outFlowId, targetId);
      break;
    case 'cloud':
      execTargetId.broadcast(targetId);
      execProgTargetDeviceFromCloud(progPath, inFlowId, outFlowId);
      break;
    default:
      throw new Error('invalid jsys.type: ' + jsys.type);
  }
}

// exec prog.jxe
// exec prog.jxe @cloud
// exec prog.jxe @fog [X]
// exec prog.jxe @device X
function handleExecProg(progPath, inFlowId, outFlowId, targetType, targetId) {
  if (!progPath) {
    throw new Error('progPath must be specified');
  }

  switch (targetType) {
    case '@cloud':
      handleExecProgCloud(progPath, inFlowId, outFlowId);
      break;
    case '@fog':
      handleExecProgFog(progPath, inFlowId, outFlowId, targetId);
      break;
    case '@device':
      handleExecProgDevice(progPath, inFlowId, outFlowId, targetId);
      break;
    default:
      execProg(progPath, inFlowId, outFlowId, getJobId());
      break;
  }
}

// exec prog1.jxe [> prog2.jxe ...] [< fileA] [> fileB]
// exec prog1.jxe [> prog2.jxe ...] [< fileA] [> fileB] @cloud
// exec prog1.jxe [> prog2.jxe ...] [< fileA] [> fileB] @fog [X]
// exec prog1.jxe [> prog2.jxe ...] [< fileA] [> fileB] @device X
function handleMultiExecProg(execArgs) {
  var progPaths = execArgs.progPaths;
  var inFile = execArgs.inFile;
  var outFile = execArgs.outFile;
  var targetType = execArgs.targetType;
  var targetId = execArgs.targetId;

  var prevFlowId = '';
  var currFlowId = '';

  if (inFile) {
    inFile = path.resolve(inFile);
    progPaths.unshift(FILE_TO_FLOW_PROG_PATH);
    prevFlowId = inFile;
  }
  if (outFile) {
    outFile = path.resolve(outFile);
    progPaths.push(FLOW_TO_FILE_PROG_PATH);
  }

  for (var i = 0; i < progPaths.length; i++) {
    currFlowId = (i + 1 < progPaths.length) ? getFlowId() : (outFile ? outFile : '');
    handleExecProg(progPaths[i], prevFlowId, currFlowId, targetType, targetId);
    prevFlowId = currFlowId;
  }
}

// parses the arguments of the exec command
function parseExec(args) {
  var progPaths = [];
  var inFile = null;
  var outFile = null;
  var targetType = null;
  var targetId = null;

  var mode = null;
  for (var i = 0; i < args.length; i++) {
    var arg = args[i];
    var prefix = arg.charAt(0);
    if (prefix == '@') {
      // @cloud, @fog, @device
      targetType = arg;
      mode = '@';
    } else if (prefix == '<') {
      // <, <fileA
      if (arg.length == 1) {
        // <
        mode = '<';
      } else {
        // <fileA
        inFile = arg.substring(1);
        mode = null;
      }
    } else if (prefix == '>') {
      // >, >prog2.jxe, >fileB
      if (arg.length == 1) {
        // >
        mode = '>';
      } else {
        // >prog2.jxe, >fileB
        arg = arg.substring(1);
        if (isJAMScriptProgram(arg)) {
          // >prog2.jxe
          if (progPaths.length > 0) {
            progPaths.push(arg);
          } else {
            throw new Error('invalid pipeline (missing input program): ' + arg);
          }
        } else {
          // >fileB
          outFile = arg;
        }
        mode = null;
      }
    } else {
      // targetId, prog1.jxe, prog2.jxe, fileA, fileB
      if (mode == '@') {
        // targetId, prog1.jxe
        if (isJAMScriptProgram(arg)) {
          // prog1.jxe
          progPaths.push(arg);
        } else {
          // targetId
          targetId = arg;
        }
      } else if (mode == '<') {
        // fileA
        inFile = arg;
      } else if (mode == '>') {
        // prog2.jxe, fileB
        if (isJAMScriptProgram(arg)) {
          // prog2.jxe
          if (progPaths.length > 0) {
            progPaths.push(arg);
          } else {
            throw new Error('invalid pipeline (missing input program): ' + arg);
          }
        } else {
          // fileB
          outFile = arg;
        }
      } else {
        // prog1.jxe
        if (isJAMScriptProgram(arg)) {
          progPaths.push(arg);
        } else {
          throw new Error('invalid program (missing extension): ' + arg);
        }
      }
      mode = null;
    }
  }

  return {
    progPaths: progPaths,
    inFile: inFile,
    outFile: outFile,
    targetType: targetType,
    targetId: targetId
  };
}

// changes the current working directory in the current node's subtree
jasync function changeDirectory(path) {
  try {
    process.chdir(path);
  } catch (e) {
    vorpal.log(e.message);
  }
}

vorpal
  .command('pwd', 'Prints the current working directory of the current node.')
  .action(function(args, callback) {
    vorpal.log(process.cwd());
    callback();
  });

vorpal
  .command('cd <path>', 'Changes the current working directory in the current node\'s subtree.')
  .action(function(args, callback) {
    changeDirectory(args.path);
    callback();
  });

vorpal
  .command('ls', 'Lists the contents of the current working directory of the current node.')
  .action(function(args, callback) {
    var files = fs.readdirSync(process.cwd());
    for (var i = 0; i < files.length; i++) {
      vorpal.log(files[i]);
    }
    callback();
  });

vorpal
  .command('exec [args...]', 'Executes compiled JAMScript programs in a subtree.\n' +
                             'To execute in the current node\'s subtree run:\n' +
                             'exec prog1.jxe [> prog2.jxe ...] [< fileA] [> fileB]\n' +
                             'To execute in the entire tree run:\n' +
                             'exec prog1.jxe [> prog2.jxe ...] [< fileA] [> fileB] @cloud\n' +
                             'To execute in fog X\'s subtree or the subtree of the fog above the current node run:\n' +
                             'exec prog1.jxe [> prog2.jxe ...] [< fileA] [> fileB] @fog [X]\n' +
                             'To execute in device X\'s subtree run:\n' +
                             'exec prog1.jxe [> prog2.jxe ...] [< fileA] [> fileB] @device X\n' +
                             'In all cases, the arguments can be provided in any order.')
  .action(function(args, callback) {
    try {
      var execArgs = parseExec(args.args);
      handleMultiExecProg(execArgs);
    } catch (e) {
      vorpal.log(e.message);
    }
    callback();
  });

vorpal
  .command('jobs', 'Lists all JAMScript programs spawned by the shell in the current node\'s subtree.')
  .action(function(args, callback) {
    var jobsLogged = getJobsLogged();
    if (jobsLogged.length > 0) {
      jobsLogged.sort(compareJobsLogged);
      vorpal.log('NODETYPE', 'NODEID' + ' '.repeat(30), 'JOBID' + ' '.repeat(31), 'APP');
      for (var i = 0; i < jobsLogged.length; i++) {
        var job = jobsLogged[i];
        vorpal.log(job.nodeType + ' '.repeat(8 - job.nodeType.length), job.nodeId, job.jobId, job.app);
      }
    }
    callback();
  });

vorpal
  .command('kill <job> [targetType] [targetId]', 'Kills jobs in a subtree by APP (default) or JOBID.')
  .option('--id', 'job is JOBID instead of APP')
  .action(function(args, callback) {
    try {
      var idType = args.options.hasOwnProperty('id') ? 'id' : 'app';
      var progPath = JAMSHELL_HOME + '/killJob/' + idType + '/' + args.job;
      handleExecProg(progPath, '', '', args.targetType, args.targetId);
    } catch (e) {
      vorpal.log(e.message);
    }
    callback();
  });

vorpal
  .command('info', 'Displays information about the current node.')
  .action(function(args, callback) {
    vorpal.log('node type:', jsys.type);
    vorpal.log('node id:', jsys.id);
    callback();
  });

// populate jobs from jobs logged before executing the first command
vorpal.addListener('client_prompt_submit', (function() {
  function listener() {
    jobs = getMyJobsLogged();
    vorpal.removeListener('client_prompt_submit', listener);
  }
  return listener;
})());

if (config.echo) {
  vorpal.addListener('client_prompt_submit', function(command) {
    vorpal.log('[' + Date.now() + ']', command);
  });
}

vorpal.historyStoragePath(JAMSHELL_HOME + '/' + jsys.getMQTT().port);
vorpal.history('jamshell');

vorpal
  .delimiter('>>')
  .show();
