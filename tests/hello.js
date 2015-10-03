module.exports = {
    getAllFunctions: function(){ 
      var myfunctions = [];
      for (var l in this){
        if (this.hasOwnProperty(l) && this[l] instanceof Function && !/myfunctions/i.test(l)){
          myfunctions.push({name:l, func:this[l]});
        }
      }
      return myfunctions;
     },

     hello: function (self, sock) {
        console.log("Hello, World!", self.servinfo);
        reply = JSON.stringify({name:"ERROR", tag: "activity-name", args:[], cback:"xyzwopq"}) + "\n";
        sock.write(reply);
        reply = JSON.stringify({name:"VERIFY", tag: "activity-name", args:[ "verify-test", "Kandy"], cback:"fghjij"}) + "\n";
        sock.write(reply);
        reply = JSON.stringify({name:"ERROR", tag:"activity-name", args:[ "etest-2", 343, "Colombo"], cback:"kijlmno"}) + "\n";
        sock.write(reply);
        reply = JSON.stringify({name:"COMPLETE", tag: "activity-name", args:[ "complete", 13.4, "London", 102], cback:"efgh"}) + "\n";
        sock.write(reply);
        reply = JSON.stringify({name:"CANCEL", tag: "activity-name", args:[ "cancel", "London"], cback:"abcde"}) + "\n";
        sock.write(reply);
    }
};