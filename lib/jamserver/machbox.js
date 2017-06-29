
module.exports = new function() {
    
    this.functions = {
        "testfunc": function testfunc(arg) {console.log("Printing from testfunc  ", arg); },
        "hellofunc": function hellofunc(arg) {console.log("Printing from hellofunc ", arg); },
        "resultfunc": function resultfunc(arg) {console.log("Print from result func  ", arg);}
    },

    this.signatures = {
        "testfunc": "s",
        "hellofunc": "s",
        "resultfunc": "s"
    }
}