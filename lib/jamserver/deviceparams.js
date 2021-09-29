const {Random, MersenneTwister19937} = require('random-js');

const ps = require('ps-node');

var localStorage;

module.exports = new function(){

	this.init = function(fname){
		/* create a local storage if there's not one
		 * using the file name specified by fname
		 */
		if(typeof localStorage === 'undefined' || localStorage === null) {
			var LocalStorage = require('node-localstorage').LocalStorage;
			localStorage = new LocalStorage(fname);
		}

        // Check whether we have a process already there at the port
        var pcsId = localStorage.getItem('processId');
        if (pcsId !== null) {
            ps.lookup({pid: pcsId}, function(err, rl) {
                var rli = rl[0];
                if (rli) {
                    console.log("ERROR! Another process is running at port: ", fname);
                    process.exit(1);
                }
            });
        }

        // If not store this one there...
        localStorage.setItem('processId', process.pid);

		/* assign a randomly-generated value to the deviceId field of the local storage
		 * if it is not set
		 */
		if(localStorage.getItem('deviceId') === null) {
			const random = new Random(MersenneTwister19937.autoSeed());
			localStorage.setItem('deviceId', random.uuid4());
		}
	};

	/* get the value associated with key stored in local storage */
	this.getItem = function(key){
		return localStorage.getItem(key);
	};

	/* set a key-value pair in local storage */
	this.setItem = function(key, value){
		localStorage.setItem(key, value);
	};
};
