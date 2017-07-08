
jdata {
    int x as logger;
    int y as logger;
}

jasync function js_read() {

    setTimeout(function() {
	    console.log(x.jlogger_get_newest_value());
	    console.log(y.logger_get_newest_value());
    }, 2000);

}

