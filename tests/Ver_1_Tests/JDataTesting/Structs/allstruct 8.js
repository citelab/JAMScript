
jdata {

    struct announce_msg_t {
	float a_val;
	char *field;
	int index;
    } announce_msg as broadcaster;
    
    struct sensor_data {
	float sd_val;
	char *name;
	int index;
    } sensor_data as logger;
}


var alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function getstring() {

    // length is [6,12]
    var len = 6 + Math.round(Math.random()*6);
    var buf = [];
    for (i = 0; i < len; i++)
	buf.push(alpha[Math.floor(Math.random()*alpha.length)]);

    return buf.join('');
}

setInterval(function() {

    var msg = {a_val: Math.random() * 10.0, field: getstring(), index:Math.round(Math.random() * 100)};
    
    announce_msg.broadcast(msg);
    
}, 300);


sensor_data.subscribe (function(x, y, z) {

    for (i = 0; i < sensor_data.size(); i++)
        if (sensor_data[i] !== undefined)
            console.log(sensor_data[i].lastValue());
});
