var async = require('asyncawait/async');
var await = require('asyncawait/await');

function resolveAfter2Seconds(x) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(x);
    }, 500);
  });
};


var add = async(function(x) { // async function expression assigned to a variable
	var a = await(resolveAfter2Seconds(20));
	var b = await(resolveAfter2Seconds(30));
  return x + a + b;
    });

console.log("World...");
add(10).then(v => {
  console.log(v);  // prints 60 after 4 seconds.
});
console.log("helllo");
