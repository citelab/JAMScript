jdata {
    int x as logger;
}


setInterval(function() {

    for (i = 0; i < x.size(); i++) {
	if (x[i] !== undefined && !x[i].isEmpty()) {
            process.stdout.write(x[i].lastValue() + " | ");
	}
    }
    process.stdout.write("\n");
}, 1000);
