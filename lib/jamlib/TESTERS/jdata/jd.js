
jdata {
    int xx as logger;
//    int y as logger;
}

jasync function js_read() {

    setTimeout(function() {
	    console.log(xx.jlogger_get_newest_value());
	    //	    console.log(yyyy.jlogger_get_newest_value());
    }, 2000);

}

