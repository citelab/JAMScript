var jobs = ["ab", "cd"]; // Array of strings
var assigned = new Map();
var sum = 0;
var timeout = 3000;

jsync function getJob(id) {
	if(jobs.length > 0) {
		var job = jobs.pop();
		assigned.set(id, {
			job: job, 
			startTime: new Date().getTime()
		});
		return job;
	} else {
		return "";
	}
}

jasync function returnResults(id, results) {
	if(assigned.has(id)) { // Check if the job has timed before completion
		assigned.delete(id);
	} 
	sum += results;
}

function checkTimeouts() {
	var timeLimit = new Date().getTime() - timeout;
	assigned.forEach(function(data, key) {
		if(data.startTime > timeLimit) {
			jobs.push(data.job);
			assigned.delete(key);
		}
	});
	if(jobs.length === 0) {
		clearInterval(interval);
		console.log("Total sum: " + sum);
	}
}

var interval = setInterval(checkTimeouts, 500); // Check timeouts every 0.5 seconds

