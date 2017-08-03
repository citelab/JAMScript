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
	struct weather{
		float temperature;
		float humidity;
		float wind;
		char* air_quality;
		char* UV;
	} MTLWeather as logger;
}
```  
  
  
### **Subscribing to a logger**  
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
	the function that is called by all listener applications of the logger that **subscribe()** is called upon.  

	key  
		the identifier of the logger that **subscribe()** is called upon.
	entry  
		the new data whose arrival triggers this callback function.
	datastream  
		the identifier of the listener application of the logger.  
  
  
  
### **JAMDatastream**  
A logger can be listened to by multiple applications. We call each listener application of a logger its datastream.

#### JAMDatastream.size()  
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


#### JAMDatastream.lastData()

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


#### JAMDatastream.lastValue()

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


#### JAMDatastream.data()

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


#### JAMDatastream.values()

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


#### JAMDatastream.n_data(n)

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
n: an integer value


#### JAMDatastream.n_values(n)

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
n: an integer value


#### JAMDatastream.dataAfter()

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
timestamp: a Date object


#### JAMDatastream.valuesAfter()

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
timestamp: a Date object


#### JAMDatastream.dataBetween()

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
fromTimestamp: a Date object  
toTimestamp: a Date object


#### JAMDatastream.valuesBetween()

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
fromTimestamp: a Date object
toTimestamp: a Date object


  
## Flow
Flow is an abstract data type that enables efficient processing of a large data set. It provides a handful of methods to group, transform and filter the entering data. 

### **Declaring a Flow variable**

A flow can be built upon various data structures, including Array, Set, Map, Object, FileSystem, Generator, JAMDatasource and JAMDatastream.  

#### ** `Flow.from()` creates a flow on a logger.**
```shell
jdata{
	<loggerType> <loggerName> as logger;
}
var a = [1,2,3,4,5];

// Creates a flow on a JAMLogger
var aFlow = Flow.from(<loggerName>);

// Creates a flow on an array  
var f = Flow.from(a);
```  
**Syntax**  
Flow.from(data);    
**Parameter**  
A variable of type Array, Set, Map, Object, FileSystem, Generator, JAMDatasource or JAMDatastream
**Return value**  
A flow contains all data in the argument data structure.  


#### **Creates a flow in jdata{...} section**
A flow built upon a JAMLogger can be declared either in a jdata{...} section or outside as above.  

```shell
jdata{
	<loggerType> <aLogger> as logger;
	<flowName> as flow with <flowFunc> of <aLogger>
}

function <flowFunc> (rawFlow){
	// ...
}
```  
Declare a logger first. Then declare the flow built upon it.  
`<flowName>`: the name of this flow variable.  
`<flowFunc>`: the name of the function to process the raw flow from the intended logger.  
`<aLogger>`: the name of the logger variable on which this logger is initialized.
  
`function <flowFunc> (rawFlow)`:   
Every flow on logger has to be associated with a function to process the raw flow.  
**Parameter**  
rawFlow: the raw flow contains all data that the logger on which the flow is built recorded.  
**Return value**  
A flow  
  
**Example:**
```shell
jdata{
	struct weather{
		int date;
		int highTemperature;
		int lowTemperature;
		float humidity;
		float wind;
		char* airQuality;
		char* UV;
	} MTLWeather as logger;

	stats as flow with statsFunc of MTLWeather; 
}  

function statsFunc(rawFlow){
	return rawFlow.discretize(1,7);
}
```
The above code first declares a logger called `MTLWeather` with type `struct weather`, then a flow with name `stats` and a function `statsFunc` on logger `MTLWeather`. `statsFunc` takes `stats` flow as its argument, and returns a flow created by a flow method `discretize()`.  
  
  
### 5 Types of Flow  
IteratorFlow, OutFlow, InFlow, DiscretizedFlow and Flow (the default Flow). They are grouped based on the type of operations that can be performed on them.  
  
#### IteratorFlow  
An IteratorFlow is created when Flow.from() is called. Other flows can be created by applying flow methods on an iterator flow, which is the root flow in the flow chain and can be accessed via the property `rootFlow`.  
**Example:**  
```shell
var firstFlow = Flow.from([1,2,3,4,5]);

// creates a flow contains only the even number in firstFlow
var anotherFlow = firstFlow.where(entry => entry.data%2==0);
```  

#### OutFlow  
An OutFlow is responsible for processing and sending data across applications.  
  
#### InFlow
An InFlow is responsible for receiving data from other applications.  
  
#### DiscretizedFlow  
This Flow splits data streams into chunks/windows to allow for Flow methods that require finite data operations.  

  
### Flow Operations  
Flow operations can either be methods/transformations (operations that yield other Flows) or actions (operations that yield a result).
  
* Flow methods  
Each flow method is a data transformation that yields another flow. A flow maintains a call tree to the flow operation before it. A flow method is lazily computed as the data is continuously pipelined to the next level of flow and is only computed when a flow action is called upon it.    

#### The `Flow.limit(Number)` method limits the number of results obtained after the previous operation.
```shell
var firstFlow = Flow.from([1,2,3,4,5,6,7]);
var anotherFlow = firstFlow.limit(4);	// anotherFlow contains [1,2,3,4]
```  
**Syntax**  
Flow.limit(n)  
**Parameter**
n: an integer indicating the number of data to pipe.  
**Return value**  
A flow that contains the first n data from the root flow. 

#### The `Flow.skip()` method ignores the first given number of results found after a previous operation.
```shell
var firstFlow = Flow.from([1,2,3,4,5,6,7]);
var anotherFlow = firstFlow.skip(4);	// anotherFlow contains [5,6,7]
```  
**Syntax**  
Flow.skip(n)  
**Parameter**
n: an integer indicating the number of data to skip.  
**Return value**  
A flow that contains all data excluding the first n data from the root flow.   

#### The `Flow.select()` method is similar to map in mad-reduce operations. It applies a provided function on every entry in the calling flow.  
```shell
var firstFlow = Flow.from([1,2,3,4,5,6,7]);
var anotherFlow = firstFlow.select(entry => entry*2);	// anotherFlow contains [2,4,6,8,10,12,14]
```  
**Syntax**  
Flow.select(aFunction)  
**Parameter**
aFunction: a function that is going to be applied on every entry in the calling flow.
**Return value**  
A flow that contains all data returned by applying the provided function on every entry in the calling flow.  
  
#### The `Flow.selectFlatten()` flattens a flow of arrays.
```shell
var firstFlow = Flow.from([1,2,3],[4,5],[6,7,8,9]);
var anotherFlow = firstFlow.selectFlatten();	// anotherFlow contains [1,2,3,4,5,6,7,8,9]
```  
**Syntax**  
Flow.selectFlatten()  
**Parameter**
None
**Return value**  
A flow that contains all data in the calling flow in the flattened form.  
  
#### The `Flow.selectExpand()` flattens a flow of arrays and applies the provided function to each entry of the flattened flow. The collection generated by function must be supported by Flow.from(...).  
```shell
var firstFlow = Flow.from([1,2,3],[4,5],[6,7,8,9]);
var anotherFlow = firstFlow.selectExpand(data => data*2);	// anotherFlow contains [2,4,6,8,10,12,14,16,18]
```  
**Syntax**  
Flow.selectExpand(aFunction)  
**Parameter**
aFunction: a function that is going to be applied on each data in the flattened flow.
**Return value**  
A flow that contains all results returned by applying the provided function on every data in the calling flow in the flattened form.  

#### The `Flow.where()` method performs a filtering operation on the data to match a constraint.  
```shell
var firstFlow = Flow.from([1,2,3,4,5,6,7]);
var anotherFlow = firstFlow.where(entry => entry%2 == 0);	// anotherFlow contains [1, 4, 6]
```  
**Syntax**  
Flow.where(aFunction)    
**Parameter**  
aFunction: a function that is going to be applied on each data in the flattened flow. It returns a boolean.  
**Return value**  
A flow that contains all data whose `aFunction(data)` is true.  


#### `Flow.orderBy()` method performs a sorting operation on the data based on a given function. 
```shell
var firstFlow = Flow.from([9,1,8,3,7,4,2,5,6]);

// anotherFlow contains [1,2,3,4,5,6,7,8,9]  
var anotherFlow = firstFlow.orderBy();	

// anotherFlow contains [9,8,7,6,5,4,3,2,1]  
var yetAnotherFlow = firstFlow.orederBy((data1, data2) => {
	if(data1 < data2) return -1;
	if(data1 > data2) return 1;
	return 0;
});		
```  
**Syntax**  
Flow.orderBy(compareFunction)  
**Parameter**
compareFunction (optional): a function that defines an alternative sort order. The function takes two arguments, say data1 and data2. If a positive value is returned, then data1 is sorted before data2; if a negative value is returned, then data2 is sorted before data1; if 0 is returned, then data1 and data2 preserves their original order.  
**Return value**  
A flow that contains all data in the calling flow in the intended sorted order.  
  
#### The `Flow.groupBy()` method returns a new Flow containing several datasets grouped by a specified key. 
```shell
var firstFlow = Flow.from([
	{	
		type: "student",
		year: "U2"
		name: "Lilly"
	},
	{
		type: "student",
		year: "U0"
		name: "Jim"
	},
	{
		type: "professor",
		name: "Tom"
	},
	{
		type: "professor",
		name: "Anne"
	}
]);


/* anotherFlow contains 
{
	"student": [
		{	
			type: "student",
			year: "U2"
			name: "Lilly"
		},
		{
			type: "student",
			year: "U0"
			name: "Jim"
		}
	],
	"professor":[
		{
			type: "professor",
			name: "Tom"
		},
		{
			type: "professor",
			name: "Anne"
		}
	]
}
*/
var anotherFlow = firstFlow.groupBy("type");	
```  
**Syntax**  
Flow.groupBy(key)    
**Parameter**  
key: a string indicating the key used to group data in the calling flow.
**Return value**  
A flow containing data in the calling flow partitioned into groups of array determined by the values of the intended key.  

#### The `iteratorFlow.merge()` method is only available to an object of IteratorFlow and is used to merge a supported data structure. Merging creates an Iterator and adds it to the current Iterator or Iterators.   
  
#### The `Flow.range()` method creates a bound for the data to be used for further processing.
```shell
var firstFlow = Flow.from([1,2,3,4,5,6,7]);

// anotherFlow contains [1,2,3,4,5,6,7,8,9]  
var anotherFlow = firstFlow.range(2, 8);	// another flow contains: [3,4,5,6,7,8]
```  
**Syntax**  
Flow.range(startIndex, endIndex)  
**Parameter**  
startIndex: an integer indicating the index of the first element (inclusive)  
endIndex: an integer indicating the index of the last element (exclusive)  
**Return value**  
A flow that contains data with indices between startIndex (inclusive) and endIndex (exclusive) in the calling flow.   

#### The `Flow.discretize()` method is only available to the IteratorFlow and allows processing data streams in windows.  
```shell
jdata{
	int x as logger;
	f as flow with flowFunc of x;
}

function flowFunc(f){
	return f.discretize(3, 5);   
}
```  
**Syntax**  
Flow.discretize.(span, spanLength[, spawnFlows])   
**Parameter**  
span: span is the number of data streams to focus on in a window.  
spanLength: either a Number or a function that tells when we get to the end of a window. 
spawnFlows: an optional boolean value that states if the output should be objects of DiscretizedFlow or simple arrays. spawnFlows defaults to true.   
**Return value**  
A flow that contains arrays of data from the specified number of datastreams. Each array contains the first `spanLength` data from a datastream that subscribes to the data structure on which the flow is built.