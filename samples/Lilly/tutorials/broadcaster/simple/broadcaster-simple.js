jdata {
    char* curTime as broadcaster;
}

setInterval(function(){
	var d = new Date();
	var now = String(Number(d.getYear()+1900)+"-"+Number(d.getMonth()+1)+"-"+d.getDate()+" "+d.getHours()+":"+d.getMinutes()+":"+d.getSeconds());
	curTime.broadcast(now);
}, 1000);