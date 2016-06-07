var readline = require('readline');

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
    });

rl.question('What are the choices??   ', (ans) => {
	console.log("Here is the answer:  " + ans);
    });