'use strict'

const JAMDatasource = require('./jamdatasource.js');

module.exports = class JAMIopad extends JAMDatasource{

	/* an iopad has neither source nor destination */
	constructor(jammanager, name){
		super(jammanager, 'iopad', name, undefined, undefined);
	}

	/* Public API 
	 * all functions return -1 on fail
	 */

	/* returns the number of datastreams on this iopad */
	numOfStream(){
		return this.length;
	}
}