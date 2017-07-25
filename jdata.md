---
layout: page
title: JData
subtitle: JData Documentation
---

JData comes in two types: a logger and a broadcaster.

## Logger

A logger keeps track of the changes of a value. 

### **Declaring a logger variable**
A logger has to be declared in a jdata{...} section.
```shell
jdata{
	<type> <name> as logger;
}
```
`<type>`: the type of the value that the logger keeps track of. Possible values: int, double, float, char*, and user-defined structures.
`<name>`: the name of this logger.

**Example:** declaring a logger to keep track of an integer value:
```shell
jdata {
	int candidate1 as logger;
}
```

A structure logger is declared using the syntax of C Prgoramming Language.  
**Example:** declaring another logger to keep track of an user-defined type - struct weather:
```shell
jdata {
	int candidate1 as logger;

	struct weather{
		float temperature;
		float humidity;
		float wind;
		char* air_quality;
		char* UV;
	} MTLWeather as logger;
}
```


### **Logger class provides a wide range of useful APIs**


#### JAMLogger.subscibe()

The **subscribe()** method pushes a callback function to the logger that it is called upon, such that all the applications that listens to this logger will call that function when the logger records a new value change.  

```shell  
jdata {
	int aNumber as logger;
}

aNumber.subscribe(function(key, entry, datastream){
	console.log("New data:",entry);
});
```

**Syntax**

JAMLogger.subscribe(function callback(key, entry, datastream){
	// ...
})

**Return value**  

None

**Parameters**

callback  
	function that is called by all listener applications of the logger that **subscribe()** is called upon.

	key  
		the identifier of the logger that **subscribe()** is called upon.
	entry
		the new data whose arrival triggers this callback function.
	datastream
		the identifier of the listener application of the logger.


### JAMDatastream.size()

The **size()** method returns the number of records the logger has tracked.
```shell  
jdata {
	int aNumber as logger;
}

aNumber.subscribe(function(key, entry, datastream){
	var size = datastream.size();
	console.log("aNumber has recorded "+size+" value changes");
	// stdout: aNumber has recorded 10 value changes
});
```

**Syntax**

JAMDatastream.size();

**Return value**

The number of records the callee logger has tracked.

**Parameter**

None


### JAMDatastream.lastData()

The **lastData()** method returns the latest value along with its timestamp.

```shell  
jdata {
	int aNumber as logger;
}

aNumber.subscribe(function(key, entry, datastream){
	var data = datastream.lastData();
	console.log("Latest value is",lastData.value);
	console.log("Updated at",lastData.timestamp);

	// stdout:
	// Newest value is 32
	// Updated at 2017-02-23T23:08:51.141Z4
});
```

**Syntax**

JAMDatastream.lastData()

**Return value**

Returns the last data pair (value, timestamp) in the data stream or null if the data stream is empty. Value is of type Number and timestamp is of type Date.

**Parameters**

None.


### JAMDatastream.lastValue()

The **lastValue()** method returns the latest value.

```shell  
jdata {
	int aNumber as logger;
}

aNumber.subscribe(function(key, entry, datastream){
	var value = datastream.lastValue();
	console.log("Latest value is",value);

	// stdout:
	// Newest value is 32
});
```

**Syntax**

JAMDatastream.lastValue()

**Return value**

Returns the last value in the data stream or null if the data stream is empty. Value is of type Number.

**Parameters**

None.


### JAMDatastream.data()

The **data()** method returns all the values in the data stream along with their timestamps.

```shell  
jdata {
	int aNumber as logger;
}

aNumber.subscribe(function(key, entry, datastream){
	var allData = datastream.data();
	console.log("Display the entire record");
	console.log(allData);

	// stdout:
	// Display the entire record
	// [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]
});
```

**Syntax**

JAMDatastream.data()

**Return value**

Returns all the (value, timestamp) that the callee logger has recorded, or null if the data stream is empty. Value is of type Number and timestamp is of type Date.

**Parameters**

None.


### JAMDatastream.values()

The **values()** method returns all the values in the data stream along with their timestamps.

```shell  
jdata {
	int aNumber as logger;
}

aNumber.subscribe(function(key, entry, datastream){
	var allValues = datastream.values();
	console.log("Display the entire record");
	console.log(allValues);

	// stdout:
	// Display the entire record
	// [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]
});
```

**Syntax**

JAMDatastream.data()

**Return value**

Returns all the (value, timestamp) that the callee logger has recorded, or null if the data stream is empty. Value is of type Number and timestamp is of type Date.

**Parameters**

None.


### JAMDatastream.n_data(n)

The **n_data()** method returns the last n values in the data stream along with their timestamps.

```shell  
jdata {
	int aNumber as logger;
}

aNumber.subscribe(function(key, entry, datastream){
	if(datastrea.size()>=10)
		var data = datastream.n_data(10);
	console.log("Display the most recent 10 records");
	console.log(data);

	// stdout:
	// Display the most recent 10 records
	// [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]
});
```

**Syntax**

JAMDatastream.n_data(n)

**Return value**

Returns an array containing the last N data pairs (value, timestamp) in the data stream. The values are of type Number and the timestamps are of type Date. Parameter N is a positive integer. If N is invalid, then an exception is thrown. If there are fewer than N data pairs in the data stream, then the length of the returned array is smaller than N.

**Parameters**

n
	an integer value


### JAMDatastream.n_values(n)

The **n_data()** method returns the last n values in the data stream.

```shell  
jdata {
	int aNumber as logger;
}

aNumber.subscribe(function(key, entry, datastream){
	if(datastrea.size()>=10)
		var values = datastream.n_values(10);
	console.log("Display the most recent 10 records");
	console.log(values);

	// stdout:
	// Display the most recent 10 records
	// [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]
});
```

**Syntax**

JAMDatastream.n_data(n)

**Return value**

Returns an array containing the last N values (of type Number) in the data stream. Parameter N is a positive integer. If N is invalid, then an exception is thrown. If there are fewer than N values in the data stream, then the length of the returned array is smaller than N.

**Parameters**

n
	an integer value


### JAMDatastream.dataAfter()

The **dataAfter()** method returns the values along with their timestamps recorded after a specific timestamp in the data stream.

```shell  
jdata {
	int aNumber as logger;
}

aNumber.subscribe(function(key, entry, datastream){
	var today = new Date(2017, 6, 19, 0, 0, 0);
	var dataToday = device.dataAfter(today);

	console.log("Received "+dataToday.length+" data today");

	// stdout:
	// Received 3000 data today
});
```

**Syntax**

JAMDatastream.dataAfter(n)

**Return value**

Returns an array containing all data pairs (value, timestamp) in the data stream with a timestamp after timestamp (exclusive). Value is of type Number and timestamp is of type Date. 

**Parameters**

timestamp
	a Date object


### JAMDatastream.valuesAfter()

The **valuesAfter()** method returns the values recorded after a specific timestamp in the data stream.

```shell  
jdata {
	int aNumber as logger;
}

aNumber.subscribe(function(key, entry, datastream){
	var today = new Date(2017, 6, 19, 0, 0, 0);
	var valuesToday = datastream.valuesAfter(today);

	console.log("Received "+valuesToday.length+" values today");

	// stdout:
	// Received 3000 values today
});
```

**Syntax**

JAMDatastream.valuesAfter(timestamp)

**Return value**

Returns an array containing all values of type Number in the data stream recorded after timestamp.

**Parameters**

timestamp
	a Date object


### JAMDatastream.dataBetween()

The **dataBetween()** method returns the values recorded during a specifc time period in the data stream along with their timestamps.

```shell  
jdata {
	int aNumber as logger;
}

aNumber.subscribe(function(key, entry, datastream){
	// year, month-1, date, hour, minute, secod
	var yesterday = new Date(2017, 6, 19, 0, 0, 0);
	var today = new Date(2017, 6, 20, 0, 0, 0);

	var dataYesterday = datastream.dataBetween(yesterday, today);
	var numData = dataYesterday.length;
	console.log("Received "+numData+" data yesterday");

	// stdout
	// Received 5000 data yesterday
});
```

**Syntax**

JAMDatastream.dataBetween(fromTimestamp, toTimestamp)

**Return value**

Returns an array containing all data pairs (value, timestamp) in the data stream with a timestamp between fromTimestamp and toTimestamp (both exclusive). For each data pair, the value is of type Number and the timestamp is of type Date.

**Parameters**

fromTimestamp
	a Date object
toTimestamp
	a Date object


### JAMDatastream.valuesBetween()

The **valuesBetween()** method returns the values recorded during a specifc time period in the data stream.

```shell  
jdata {
	int aNumber as logger;
}

aNumber.subscribe(function(key, entry, datastream){
	// year, month-1, date, hour, minute, secod
	var yesterday = new Date(2017, 6, 19, 0, 0, 0);
	var today = new Date(2017, 6, 20, 0, 0, 0);

	var valuesYesterday = datastream.valuesBetween(yesterday, today);
	var numData = valuesYesterday.length;
	console.log("Received "+numData+" values yesterday");

	// stdout
	// Received 5000 values yesterday
});
```

**Syntax**

JAMDatastream.valuesBetween(fromTimestamp, toTimestamp)

**Return value**

Returns an array containing all values of type Number in the data stream with a timestamp between fromTimestamp and toTimestamp (both exclusive). 

**Parameters**

fromTimestamp
	a Date object
toTimestamp
	a Date object
