module.exports = {
test_load: function(self,socket) {try {
    var a;
    console.log("Hello World!");
} catch(err) { socket.write(JSON.stringify({name:"ERROR", tag: "l8dkievcxr", args:[], cback:"xyzwopq"}) + "\n");}},
bad_load: function(self,socket) {try {
    var a;
    blah("Hello World!");
} catch(err) { socket.write(JSON.stringify({name:"ERROR", tag: "wc70xqiwwmi", args:[], cback:"xyzwopq"}) + "\n");}},
getAllFunctions: function(){ 
      var myfunctions = [];
      for (var l in this){
        if (this.hasOwnProperty(l) && this[l] instanceof Function && !/myfunctions/i.test(l)){
          myfunctions.push({name:l, func:this[l]});
        }
      }
      return myfunctions;
     }};