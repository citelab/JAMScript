jdata {
    int y as broadcaster;
    float x as broadcaster;
    char *z as broadcaster;
    
    struct basket{
    	int apple;
    	float pear;
    } myBasket as broadcaster;

    struct bag{
    	int pen;
    	float water;
    	int book;
    } myBag as broadcaster;
}

var i=0;

setInterval(function() {

    y.broadcast(Math.floor((Math.random() * 100) + 1));
    x.broadcast((Math.random() * 100) + 1);
    z.broadcast("Hello...");

    myBasket.broadcast({
    	apple: Math.floor(Math.random() * 100),
    	pear : 3.4
    });
    
    myBag.broadcast({
        pen: -1 * Math.floor(Math.random() * 10000000),
        water: Math.random() * 100,
	book: Math.floor(Math.random() * 100)
    });

    i++;
}, 100);
