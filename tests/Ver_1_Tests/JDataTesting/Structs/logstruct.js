console.log(">>>>>>>>>>>>>>>>>>>>>>>>>");

jdata {
    struct sensor_data {
	float sd_val;
	char *name;
	int index;
    } sensor_data as logger;
}


sensor_data.subscribe (function(x, y, z) {

    for (i = 0; i < sensor_data.size(); i++)
	if (sensor_data[i] !== undefined)
	    console.log(sensor_data[i].lastValue());
});
