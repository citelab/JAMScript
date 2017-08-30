jcond {
    sensor: sys.tag == "sensor";
    qq: sys.tag == "qq";    
}


setInterval(()=> {
    sensor_trigger();
}, 2000);


