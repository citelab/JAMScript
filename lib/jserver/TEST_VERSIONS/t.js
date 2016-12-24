var gg = 120;

module.exports = {
    gg: gg,
    simpleFunc: sFunc 
}


function sFunc(a, b) {
    gg = gg + a + b;
    console.log("a: ", a);
    console.log("b: ", b, gg);
}