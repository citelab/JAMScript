
var gvar = 10;

console.log("Global var .. ", gvar);


var x = function() {

    gvar = 2;
    console.log("Value of gvar ", gvar);
}

x();

console.log("Global var after.. ", gvar);
