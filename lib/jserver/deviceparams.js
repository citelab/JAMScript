const Random = require('random-js');

var localStorage;

module.exports = function(){
	this.init = function(fname){
		/* create a local storage if there's not one
		 * using the file name specified by fname
		 */
		if(typeof localStorage === 'undefined' || localStorage === null){
			var LocalStorage = require('node-localstorage').LocalStorage;
			localStorage = new LocalStorage(fname);
		}
		/* assign a randomly-generated value to the deviceId field of the local storage
		 * if it is not set
		 */
		if(localStorage.getItem('deviceId') === null){
			var random = new Random(Random.engines.mt19937().autoSeed());
			localStorage.setItem('deviceId', random.uuid4());
		}
	}

	/* get the value associated with key stored in local storage */
	this.getItem = function(key){
		return localStorage.getItem(key);
	}

	/* set a key-value pair in local storage */
	this.setItem = function(key, value){
		localStorage.setItem(key, value);
	}
}