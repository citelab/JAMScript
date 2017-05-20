'use strict'

const JAMDatasource = require('./jamdatasource.js');

/* a broadcaster provides a mechanism for pushing data from the cloud or fog to the deivces
 * a broadcaster contains at most one value available to the program at any given time
 * a broadcaster originates on fog or cloud nodes
 * when a broadcaster is consumed, the latest value is always used
 * conditions are used to restrict where the data originates
 */
module.exports =  class JAMBroadcaster extends JAMDatasource{

	constructor(jammanager, type, name, source, destination){
		super(jammanager, type, name, source, destination);
	}
}