jdata {  
    struct myTime{
        int year;
        int month;
        int date;
        int hour;
        int minute;
        int second;
        char* display;
    }MTLTime as broadcaster;
}

setInterval(function(){
    var d       = new Date(),
        year    = Number(d.getYear()+1900),
        month   = Number(d.getMonth()+1),
        date    = d.getDate(),
        hour    = d.getHours(),
        minute  = d.getMinutes(),
        second  = d.getSeconds(),
        display = String(year+"-"+month+"-"+date+" "+hour+":"+minute+":"+second);
    
    MTLTime.broadcast({
        year: year,
        month: month,
        date: date,
        hour: hour,
        minute: minute,
        second: second,
        display: display
    });
}, 1000);
