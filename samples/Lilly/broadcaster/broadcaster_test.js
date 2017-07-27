jdata {
    int y as broadcaster;
    struct myType{
    	int apple;
    	float pear;
    } fruit as broadcaster;

    struct anotherType{
    	int q;
    	float  xx;
	float yy;
	int zz;
    } qqq as broadcaster;
}


setInterval(function() {
    y.broadcast(Math.floor((Math.random() * 100) + 1));
    fruit.broadcast({
    	apple: Math.floor(Math.random() * 100),
    	pear : Math.random() * 1000
    });
    
    qqq.broadcast({
        q: Math.floor(Math.random() * 10),
	xx: Math.random() * 100,
	yy: Math.random() * 100,
	zz: 10
    });
}, 1000);
