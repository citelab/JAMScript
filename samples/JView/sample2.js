jdata {
    int pos as logger;
}

setInterval(function() {

	for (i = 0; i < pos.size(); i++) {
	    if (pos[i] !== undefined && pos[i].lastValue() != null)
		console.log("Pos: ", pos[i].lastValue());
	}
    }, 500);
