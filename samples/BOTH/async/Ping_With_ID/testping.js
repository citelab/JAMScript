var idcounter = 1;

jsync function getid() {
    return idcounter++;
}

jasync function pingj(src) {
    console.log("Ping received from ..", src);
}


setInterval(function() {
	doping();
}, 1000);


