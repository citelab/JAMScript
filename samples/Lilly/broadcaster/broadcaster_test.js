jdata {
    int y as broadcaster;
    struct{
    	int apple;
    	float pear;
    } s as broadcaster;
}

setInterval(function() {
    y = Math.floor((Math.random() * 100) + 1);
    s = {.apple:y, .pear:y+0.1};
}, 1000);
