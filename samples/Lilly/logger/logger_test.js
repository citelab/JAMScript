jdata {
	int t as logger;
    struct fruit{
    	int apple;
    	float pear;
    } s as logger;
}

var listener = {
    notify: function(key, entry){
        console.log(key + " - " + JSON.stringify(entry));
    }
}

t.subscribe(listener);
s.subscribe(listener);
