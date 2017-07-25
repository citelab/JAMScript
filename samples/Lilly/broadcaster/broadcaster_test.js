jdata {
    int y as broadcaster;
    struct myType{
    	int apple;
    	float pear;
    } fruit as broadcaster;
}


setInterval(function() {
    y.broadcast(Math.floor((Math.random() * 100) + 1));
    fruit.broadcast({
    	apple: Math.floor(Math.random() * 100),
    	pear : Math.random() * 1000
    });
}, 1000);
