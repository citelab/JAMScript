jdata {
    int y as broadcaster;
    struct myType{
    	int apple;
    	float pear;
    } fruit as broadcaster;
}


setInterval(function() {
    y = Math.floor((Math.random() * 100) + 1);
    var tmp = Math.floor((Math.random() * 100) + 1);
    fruit = {
    	apple: tmp,
    	pear : tmp+0.1
    };
}, 1000);
