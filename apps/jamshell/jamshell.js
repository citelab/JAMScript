jdata {
	char* execTargetId as broadcaster;
}

jcond {
	cloudOnly: sys.type == "cloud";
	fogOnly: sys.type == "fog";
	targetFogFromCloud: sys.type == "fog" && execTargetId == sys.id;
	targetDeviceFromCloud: sys.type == "device" && execTargetId == sys.id;
	targetDeviceFromFog: sys.type == "device" && execTargetId == sys.id, targetDeviceFromFogCallback;
}

var fs = require('fs');
var child_process = require('child_process');
var path = require('path');
var Random = require('random-js');
var vorpal = require('vorpal')();

// list of JAMScript programs spawned by the shell
// each job is identified by its process group ID (PGID)
var jobs = [];

// task identifier (taskId) generator
var random = new Random(Random.engines.mt19937().autoSeed());

// map from node (identified by nodeId) to tasks (identified by taskId)
// submitted by that node for execution on the current node
var tasks = new Map();

// generates a unique task identifier
function getTaskId() {
	return random.uuid4();
}

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

// executes a program in the current node's subtree
jasync function execProg(progPath) {
	var app = path.basename(progPath, '.jxe');
	var args = [progPath, '--app=' + app, '--port=' + jsys.getMQTT().port, '--' + jsys.type];
	var options = {detached: true}; // new process group
	var child = child_process.spawn('jamexec', args, options);
	jobs.push({pgid: child.pid, app: app});
}

// called from the cloud to execute a program in the target node's subtree
function execProgCloud(progPath, targetType, targetId) {
	switch (targetType) {
		case 'device':
			execTargetId.broadcast(targetId);
			execProgTargetDeviceFromCloud(progPath);
			break;
		case 'fog':
			execTargetId.broadcast(targetId);
			execProgTargetFogFromCloud(progPath);
			break;
		case 'cloud':
			execProg(progPath);
			break;
		default:
			// invalid targetType
			break;
	}
}

// called from a fog to execute a program in the target node's subtree
jasync {cloudOnly} function execProgCloudFromFog(progPath, targetType, targetId, nodeId, taskId) {
	if (!isTaskExecuted(nodeId, taskId)) {
		execProgCloud(progPath, targetType, targetId);
	}
}

// called from a device to execute a program in the target node's subtree
jasync {cloudOnly} function execProgCloudFromDevice(progPath, targetType, targetId) {
	execProgCloud(progPath, targetType, targetId);
}

// called from a device to execute a program in the target node's subtree
jasync {fogOnly} function execProgFogFromDevice(progPath, targetType, targetId) {
	switch (targetType) {
		case 'device':
			execTargetId.broadcast(targetId);
			execProgTargetDeviceFromFog(progPath, targetId);
			break;
		case 'fog':
			if (!targetId || targetId == jsys.id) {
				execProg(progPath);
			} else {
				exec_prog_cloud_from_fog(progPath, 'fog', targetId, jsys.id, getTaskId());
			}
			break;
		default:
			// invalid targetType
			break;
	}
}

// called from the cloud to execute a program in the target fog's subtree
jasync {targetFogFromCloud} function execProgTargetFogFromCloud(progPath) {
	execProg(progPath);
}

// called from the cloud to execute a program on the target device
jasync {targetDeviceFromCloud} function execProgTargetDeviceFromCloud(progPath) {
	execProg(progPath);
}

// called from a fog to execute a program on the target device which is in its subtree
jasync {targetDeviceFromFog} function execProgTargetDeviceFromFog(progPath, targetId) {
	execProg(progPath);
}

// called from a fog to execute a program on the target device which is not in its subtree
function targetDeviceFromFogCallback(params) {
	var progPath = params[0];
	var targetId = params[1];
	exec_prog_cloud_from_fog(progPath, 'device', targetId, jsys.id, getTaskId());
}

// exec prog.jxe @cloud
function handleExecProgCloud(progPath) {
	switch (jsys.type) {
		case 'device':
			exec_prog_cloud_from_device(progPath, 'cloud', '');
			break;
		case 'fog':
			exec_prog_cloud_from_fog(progPath, 'cloud', '', jsys.id, getTaskId());
			break;
		case 'cloud':
			execProg(progPath);
			break;
		default:
			throw new Error('invalid jsys.type: ' + jsys.type);
	}
}

// exec prog.jxe @fog [X]
function handleExecProgFog(progPath, targetId) {
	if (!targetId) {
		switch (jsys.type) {
			case 'device':
				exec_prog_fog_from_device(progPath, 'fog', '');
				break;
			case 'fog':
				execProg(progPath);
				break;
			default:
				throw new Error('invalid jsys.type: ' + jsys.type);
		}
	} else {
		switch (jsys.type) {
			case 'device':
				exec_prog_fog_from_device(progPath, 'fog', targetId);
				break;
			case 'fog':
				if (targetId == jsys.id) {
					execProg(progPath);
				} else {
					exec_prog_cloud_from_fog(progPath, 'fog', targetId, jsys.id, getTaskId());
				}
				break;
			case 'cloud':
				execTargetId.broadcast(targetId);
				execProgTargetFogFromCloud(progPath);
				break;
			default:
				throw new Error('invalid jsys.type: ' + jsys.type);
		}
	}
}

// exec prog.jxe @device X
function handleExecProgDevice(progPath, targetId) {
	if (!targetId) {
		throw new Error('targetId must be specified');
	}
	switch (jsys.type) {
		case 'device':
			if (targetId == jsys.id) {
				execProg(progPath);
			} else {
				exec_prog_fog_from_device(progPath, 'device', targetId);
			}
			break;
		case 'fog':
			execTargetId.broadcast(targetId);
			execProgTargetDeviceFromFog(progPath, targetId);
			break;
		case 'cloud':
			execTargetId.broadcast(targetId);
			execProgTargetDeviceFromCloud(progPath);
			break;
		default:
			throw new Error('invalid jsys.type: ' + jsys.type);
	}
}

// exec prog.jxe
// exec prog.jxe @cloud
// exec prog.jxe @fog [X]
// exec prog.jxe @device X
function handleExec(progPath, targetType, targetId) {
	switch (targetType) {
		case '@cloud':
			handleExecProgCloud(progPath);
			break;
		case '@fog':
			handleExecProgFog(progPath, targetId);
			break;
		case '@device':
			handleExecProgDevice(progPath, targetId);
			break;
		default:
			execProg(progPath);
			break;
	}
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
	.command('pwd', 'Prints the current working directory.')
	.action(function(args, callback) {
		vorpal.log(process.cwd());
		callback();
	});

vorpal
	.command('cd <path>', 'Changes the current working directory.')
	.action(function(args, callback) {
		changeDirectory(args.path);
		callback();
	});

vorpal
	.command('ls', 'Lists the contents of the current working directory.')
	.action(function(args, callback) {
		var files = fs.readdirSync(process.cwd());
		for (var i = 0; i < files.length; i++) {
			vorpal.log(files[i]);
		}
		callback();
	});

vorpal
	.command('exec <progPath> [targetType] [targetId]', 'Executes a compiled JAMScript program.')
	.action(function(args, callback) {
		try {
			handleExec(args.progPath, args.targetType, args.targetId);
		} catch (e) {
			vorpal.log(e.message);
		}
		callback();
	});

vorpal
	.command('jobs', 'Lists all spawned JAMScript programs.')
	.action(function(args, callback) {
		if (jobs.length > 0) {
			vorpal.log(' PGID APP');
			for (var i = 0; i < jobs.length; i++) {
				var job = jobs[i];
				vorpal.log(('     ' + job.pgid).slice(-5), job.app);
			}
		}
		callback();
	});

vorpal
	.command('kill <jobId>', 'Kills the specified job.')
	.action(function(args, callback) {
		var found = false;
		for (var i = 0; i < jobs.length; i++) {
			var job = jobs[i];
			if (job.pgid == args.jobId) {
				process.kill(-job.pgid);
				jobs.splice(i, 1);
				found = true;
				break;
			}
		}
		if (!found) {
			vorpal.log('no such job');
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

process.on('exit', function() {
	for (var i = 0; i < jobs.length; i++) {
		process.kill(-jobs[i].pgid);
	}
});

vorpal
	.delimiter('>>')
	.show();
