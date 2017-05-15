'use strict'

const JAMDatasource = require('./jamdatasource.js');

class JAMIopad extends JAMDatasource{
	/* an iopad has neither source nor destination */
	constructor(jammanager, 'iopad', name){
		super(jammanager, 'iopad', name);
	}

	/* Public API 
	 * all functions return -1 on fail
	 */

	/* returns the number of datastreams on this iopad */
	numOfStream(){
		return this.length;
	}

	/* check if a specific datastream exists in this iopad 
	 * returns this datastream on success
	 */
	getDatastream(devId, key){
		for(var i=0;i<that.num_datastreams;i++){
			if(this[i].devId == devId && this[i].key == key) return this[i];
		}
		return -1;
	}

	/* add data to the specified datastream in this iopad */
	addDataToStream(data, devId, key){
		var datastream = getDatastream(devId, key);
		if(datastream == -1) return -1;
		data = {
			value: Number(data.log),
			timestamp: Date(data.time_stamp * 1000)
		};
		/* add data to the specified datastream */
		datastream.redis.rawCall(['zadd', key, data], function(e, response){ if(e) return -1; });
	}

	/* returns the last data pair (value, timestamp) in the specified datastream */
	lastDataInStream(devId, key){
		var datastream = getDatastream(devId, key);
		if(datastream == -1) return -1;
		else return datastream.lastData();
	}

	lastValueInStream(devId, key){
		var datastream = getDatastream(devId, key);
		if(datastream == -1) return -1;
		else return datastream.lastValue();
	}

	/* returns an array containing all (value, timestamp) pairs in the specified datastream in this iopad */
	dataInStream(devId, key){
		var datastream = getDatastream(devId, key);
		if(datastream == -1) return -1;
		else return datastream.data();
	}

	/* returns an array containing values of all (value, timestamp) pairs */
	valuesInStream(devId, key){
		var datastream = getDatastream(devId, key);
		if(datastream == -1) return -1;
		else return datastream.values();
	}

	/* returns an array containing the last n (value, timestamp) pairs in the specified datastream in this iopad */
	nDataInStream(n, devId, key){
		var datastream = getDatastream(devId, key);
		if(datastream == -1) return -1;
		else{
			try{ datastream.nData(n);}
			catch(e){ return -1;}
		}
	}

	/* returns an array containing values of the last n values in the specified datastream in this iopad */
	nValuesInStream(n, devId, key){
		var datastream = getDatastream(devId, key);
		if(datastream == -1) return -1;
		else{
			try{ datastream.nValues(n);}
			catch(e){ return -1;}
		}
	} 

	/* returns an array containing all (value, timestamp) pairs after a time point */
	dataAfterInStream(timestamp, devId, key){
		var datastream = getDatastream(devId, key);
		if(datastream == -1) return -1;
		else{
			try{ datastream.dataAfter(timestamp);}
			catch(e){ return -1;}
		}
	}

	/* returns an array containing values of all (value, timestamp) pairs after a time point */
	valuesAfterInStream(timestamp, devId, key){
		var datastream = getDatastream(devId, key);
		if(datastream == -1) return -1;
		else{
			try{ datastream.valuesAfter(timestamp);}
			catch(e){ return -1;}
		}
	}

	/* returns an array containing all (value, timestamp) pairs that come between two specified time points */
	dataBetweenInStream(fromTimestamp, toTimestamp, datastream){
		var datastream = getDatastream(devId, key);
		if(datastream == -1) return -1;
		else{
			try{ datastream.dataBetween(fromTimestamp, toTimestamp);}
			catch(e){ return -1;}
		}
	}

	/* returns an array containing values of all (value, timestamp) come between two specified time points */
	valueBetweenInStream(fromTimestamp, toTimestamp, datastream){
		var datastream = getDatastream(devId, key);
		if(datastream == -1) return -1;
		else{
			try{ datastream.valuesBetween(fromTimestamp, toTimestamp);}
			catch(e){ return -1;}
		}
	}

}
module.exports = JAMIopad;