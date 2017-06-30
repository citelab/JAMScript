
var wait = require('wait.for-es6');
function* main() {
    console.log("Hello");
}
wait.launchFiber(main);
