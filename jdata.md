---
layout: page
title: JData
subtitle: JData Documentation
---

JData comes in two types: a logger and a broadcaster.

## Logger

A logger keeps track of the changes of a value. 

* Declaring a logger variable
```shell
jdata{
	<type> <name> as logger;
}
```
A logger has to be declared in a jdata{...} section.
`<type>`: the type of the value that the logger keeps track of. Possible values: int, double, float, char*, and user-defined structures.
`<name>`: the name of this logger.

Example: declaring a logger to keep track of an integer value:
```shell
jdata {
	int candidate1 as logger;
}
```

A structure logger is declared using the syntax of C Prgoramming Language.
Example: declaring another logger to keep track of an user-defined type - struct weather:
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

## Logger class provides a wide range of useful APIs


### loggerName.subscibe()

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

loggerName.subscribe(function callback(key, entry, datastream){
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


### loggerName.size()

The **size()** method returns the number of records the logger has tracked.
```shell  
jdata {
	int aNumber as logger;
}

aNumber.subscribe(function(key, entry, datastream){
	console.log("aNumber has recorded "+datastream.size()+" value changes");
	// stdout: aNumber has recorded 10 value changes
});
```

**Syntax**

loggerName.size();

**Return value**

The number of records the callee logger has tracked.

**Parameter**

None


### loggerName.lastData()

```shell  
jdata {
	int aNumber as logger;
}

aNumber.subscribe(function(key, entry, datastream){
	var data = datastream.lastData();
	
	// stdout: aNumber has recorded 10 value changes
});
```

The **lastData()** method returns the latest value along with its timestamp that the callee logger has recorded


**Syntax**

**Return value**

**Parameters**