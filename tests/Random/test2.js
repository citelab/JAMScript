'use strict';

const MyClass = require('./mclass');
var i = 10;
const q = require('./mclass').qm;

console.log("Imported....");
var m = new MyClass("hello", i);
m.print();

console.log("I value ", q);

var m2 = new MyClass("world");
m2.print();

const NClass = require('./nclass');

console.log("-----------");
var n = new NClass("hello3");
n.print();
