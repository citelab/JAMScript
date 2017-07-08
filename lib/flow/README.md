Flow: Data processing for JavaScript and JAMScript
==================================================
Actionable & Transformable Pipeline data processing.

Flow is part of the JAMScript Framework

Installation
------------

`npm install flows.js`


Usage
-----
The Flow library comes with several classes which can be used for different purposes. 
For the basic Flow, 'require' it as follows:

`var Flow = require('flows.js').Flow;`

Flow can be used to operate on several data types including Arrays, Sets, Maps, Objects, Generators and any JS Iterable. 
In addition, Flow is used with Datastreams and Loggers in JAMScript.

```javascript
var array = [1, 2, 3, 4, 5];

//For a very simple example. Let us count the number of even numbers in the array
var count = Flow.from(array).where((elem) => elem % 2 == 0).count();

//create a data window and return a new array
var range = Flow.from(array).skip(1).limit(3).collect(Flow.toArray);
//The above line is equivalent to
var range = Flow.from(array).range(1, 4).collect(Flow.toArray);

//a few more possibilities
var anotherArray = [6, 7, 8, 9];
var average = Flow.from(array).merge(anotherArray).select((elem) => elem * 5).average();

//check if all students passed
var studentScores = [71, 90, 55, 50, 88, 67];
var allPassed = Flow.from(studentScores).allMatch((score) => score >= 50);

//an example of selectExpand: prints ["my","name","is","richboy"]
console.log(Flow.from("my name is richboy").selectExpand((input) => input.split(" ")).collect(Flow.toArray()));

//an example of selectFlatten: prints [1,2,3,4,5,6,7,8,9]
console.log(Flow.from([[1,2,3],[4,5,6],[7,8,9]]).selectFlatten().collect(Flow.toArray()));
```


API
---

