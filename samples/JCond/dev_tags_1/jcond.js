jcond {
    sensor: sys.tag == "sensor";
}


setInterval(()=> {
    sensor_trigger();
}, 2000);


