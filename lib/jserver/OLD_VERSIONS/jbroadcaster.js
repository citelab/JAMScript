var Redis = require('redis-fast-driver');

var JBroadcaster = function(key, redis){
  this.key = key;
  this.value = null;
  this.redis = redis ? redis : new Redis({
  	host: '127.0.0.1',
  	port: 6379
  });
};

//TODO because c nodes could be going offline and coming back online, there should
//also be a means for c nodes to enquire of the current value when they come back
//online. A way should be implemented which would allow direct communication
//between the JNode and the very C node of the data. More like J->C communication
//**This seemed to have been covered in the jamlib.js file. We could just add another
//data type for enquiry on a Broadcast variable

JBroadcaster.prototype = {
  setValue: function(value){
    this.value = value;

    //broadcast to all listening nodes
    redis.rawCall(['PUBLISH', "JBROADCAST:" + this.key, this.value]);
  },
  getValue: function(){
    return this.value;
  }
};

module.exports = JBroadcaster;
