jdata {
	char* execTargetId as broadcaster;
}

jcond {
	cloudOnly: sys.type == "cloud";
	fogOnly: sys.type == "fog";
	targetFog: sys.type == "fog" && execTargetId == sys.id;
	targetDevice: sys.type == "device" && execTargetId == sys.id;
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

function getTaskId() {
	return random.uuid4();
}

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

jasync function execProg(progPath) {
	var app = path.basename(progPath, '.jxe');
	var args = [progPath, '--app=' + app, '--' + jsys.type];
	var options = {detached: true}; // new process group
	var child = child_process.spawn('jamrun', args, options);
	jobs.push({pgid: child.pid, app: app});
}

// called from multiple devices; deduplication needed
jasync {cloudOnly} function execProgCloud(progPath, nodeId, taskId, targetType, targetId) {
	if (isTaskExecuted(nodeId, taskId)) {
		return;
	}

	switch (targetType) {
		case 'device':
			execTargetId.broadcast(targetId);
			execProgTargetDevice(progPath);
			break;
		case 'fog':
			execTargetId.broadcast(targetId);
			execProgTargetFog(progPath);
			break;
		case 'cloud':
			execProg(progPath);
			break;
		default:
			// invalid targetType
			break;
	}
}

// called from single device; deduplication not needed
jasync {fogOnly} function execProgFog(progPath, targetId) {
	if (!targetId || targetId == jsys.id) {
		execProg(progPath);
	} else {
		exec_prog_cloud(progPath, jsys.id, getTaskId(), 'fog', targetId);
	}
}

// called from cloud; deduplication not needed
jasync {targetFog} function execProgTargetFog(progPath) {
	execProg(progPath);
}

// called from cloud; deduplication not needed
jasync {targetDevice} function execProgTargetDevice(progPath) {
	execProg(progPath);
}

// exec prog.jxe @cloud
function handleExecProgCloud(progPath) {
	switch (jsys.type) {
		case 'device':
		case 'fog':
			exec_prog_cloud(progPath, jsys.id, getTaskId(), 'cloud', '');
			break;
		case 'cloud':
			execProg(progPath);
			break;
		default:
			throw new Error('invalid jsys.type: ' + jsys.type);
	}
}

// exec prog.jxe @fog [X]
function handleExecProgFog(progPath, nodeId) {
	if (nodeId == undefined) {
		switch (jsys.type) {
			case 'device':
				exec_prog_fog(progPath, '');
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
				exec_prog_fog(progPath, nodeId);
				break;
			case 'fog':
				if (nodeId == jsys.id) {
					execProg(progPath);
				} else {
					exec_prog_cloud(progPath, jsys.id, getTaskId(), 'fog', nodeId);
				}
				break;
			case 'cloud':
				execTargetId.broadcast(nodeId);
				execProgTargetFog(progPath);
				break;
			default:
				throw new Error('invalid jsys.type: ' + jsys.type);
		}
	}
}

// exec prog.jxe @device [X]
function handleExecProgDevice(progPath, nodeId) {
	if (nodeId == undefined) {
		throw new Error('missing nodeId');
	}

	switch (jsys.type) {
		case 'device':
			if (nodeId == jsys.id) {
				execProg(progPath);
			} else {
				// TODO jcond exception handler
				exec_prog_cloud(progPath, jsys.id, getTaskId(), 'device', nodeId);
			}
			break;
		case 'fog':
			// TODO jcond exception handler
			exec_prog_cloud(progPath, jsys.id, getTaskId(), 'device', nodeId);
			break;
		case 'cloud':
			execTargetId.broadcast(nodeId);
			execProgTargetDevice(progPath);
			break;
		default:
			throw new Error('invalid jsys.type: ' + jsys.type);
	}
}

jasync function changeDirectory(path) {
	try {
		process.chdir(path);
	} catch (e) {
		vorpal.log(e.message);
	}
}

vorpal
	.command('jpwd', 'Prints the current working directory.')
	.action(function(args, callback) {
		vorpal.log(process.cwd());
		callback();
	});

vorpal
	.command('jcd <path>', 'Changes the current working directory.')
	.action(function(args, callback) {
		changeDirectory(args.path);
		callback();
	});

vorpal
	.command('jls', 'Lists the contents of the current working directory.')
	.action(function(args, callback) {
		var files = fs.readdirSync(process.cwd());
		for (var i = 0; i < files.length; i++) {
			vorpal.log(files[i]);
		}
		callback();
	});

vorpal
	.command('exec <progPath> [nodeType] [nodeId]', 'Executes a compiled JAMScript program.')
	.action(function(args, callback) {
		try {
			switch (args.nodeType) {
				case '@cloud':
					handleExecProgCloud(args.progPath);
					break;
				case '@fog':
					handleExecProgFog(args.progPath, args.nodeId);
					break;
				case '@device':
					handleExecProgDevice(args.progPath, args.nodeId);
					break;
				default:
					execProg(args.progPath);
					break;
			}
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
