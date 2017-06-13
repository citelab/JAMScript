/* USER INTERFACE:
jdata{
	double x as logger;
	q as flow with <flowFunc> of x;
}
*/

// create a flow from the first data stream
var flow_0 = Flow.from(x[0]);

/* FLOW METHODS */

// limit(Number)
// flow_1 is a new flow which consists of only the 1st to the 20th data from flow_0. 
var flow_1 = flow_0.limit(20);	 

// skip(Number)
// flow_2 is a new flow which consists of data after the 10th data in flow_0.
var flow_2 = flow_0.skip(10);

// select(func)
// flow_3 is a new flow which consists of data produced by adding 1 to each data in flow_0.
var flow_3 = flow_0.select(function(input){
	return input+1;
});

// selectExpand(func)
// flow_4 is a new flow which consists of data, each of which is an array that composed by 2, 3 and 4 times a data in flow_0.
// For example, if flow_0 is 1, 2, 3, 4, ......
// then flow_4 is [2,3,4], [4,6,8], [6,9,12], [8,12,16], ......
var flow_4 = flow_0.selectExpand(function(input){
	return [input*2, input*3, input*4];
});

// selectFlatten(func)
// flow_5 is a new flow which consists of data in flattened/merged form of flow_4
// For example, if flow_0 is 1, 2, 3, 4, ......
// then flow_4 is 2,3,4,4,6,8,6,9,12,8,12,16, ......
var flow_5 = flow_0.selectFlatten(function(input){
	return [input*2, input*3, input*4];
});

// where(func)
// flow_6 is a new flow which consists of data that are even numbers in flow_0.
var flow_6 = flow_0.where(function(input){
	return typedef input == 'number' && input%2 == 0;
});

// merge(data)
// flow_7 is a new flow which consists of data from flow_0 and data from array a at the end.
var a = [1,2,3,4,5,6];
var flow_7 = flow_0.merge(a);

// range(from, to)
// flow_8 is a new flow which consists of the 10th to the 20th data in flow_0.
var flow_8 = flow_0.range(10, 20);

// setTerminalFunction(func)
// each data in the last flow, which is the one that consists the 10th to the 20th data, each plus 1, from flow_0, will be logged on the screen.
flow_0.range(10, 20).select(function(input){
	return input+1;
}).setTerminalFunction(function(input){
	console.log(input);
});

/* FLOW ACTIONS */	

// count()
// numFlow is 3 as there are 3 flows after the last flow method:
// 1st flow: flow_0
// 2nd flow: flow_0.skip(10)
// 3rd flow: flow_0.skip(10).limit(20)
var numFlow = flow_0.skip(10).limit(20).count();

// collect(func)
// arr is the array form of the dataset after the last flow method.
// set is the set form of the dataset after the last flow method.
// For example, if flow_0.skip(10).limit(20) gives a flow with data: 1, 2, 3, 4, 5
// then arr is [1, 2, 3, 4, 5]
// then set is {1, 2, 3, 4, 5} 
var arr = flow_0.skip(10).limit(20).collect("toArray");
var set = flow_0.skip(10).limit(20).collect(Flow.toSet());

// foreach(func)
// logs each data in the dataset left after the last flow method.
flow_0.skip(10).limit(20).foreach(function(input){
	console.log(input);
});

// anyMatch(func)
// bool is a boolean indicating if there's a data in the dataset left after the last data method is an even number.
var bool = flow_0.skip(10).limit(20).anyMatch(function(input){
	return typeof input == 'number' && number%2 == 0;
});

// allMatch(func)
// bool is a boolean indicating if every data in the dataset left after the last data method are even numbers.
var bool = flow_0.skip(10).limit(20).allMatch(function(input){
	return typeof input == 'number' && number%2 == 0;
});

// noneMatch(func)
// bool is a boolean indicating if no data in the dataset left after the last data method is even number.
var bool = flow_0.skip(10).limit(20).noneMatch(function(input){
	return typeof input == 'number' && number%2 == 0;
});

// findFirst()
// a is the first data in the dataset left after the last flow method.
var a = flow_0.skip(10).limit(20).findFirst();

// findLast()
// b is the last data in the dataset left after the last flow method.
var b = flow_0.skip(10).limit(20).findLast();

// findAny()
// c is the first data in the dataset left after the last flow method.
var c = flow_0.skip(10).limit(20).findAny();

// reduce()
// d is the product of all data in flow_0.
var d = flow_0..reduce(1, function(prev, data){
	return prev*data;
});

// average()
// e is the average of all numbers in flow_0, where flow_0 must contains number(s).
var e = flow_0.average();

