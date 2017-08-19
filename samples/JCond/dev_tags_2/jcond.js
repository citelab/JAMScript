jcond {
    sensor: sys.tag == "sensor";
    check_a: a < 1;
}


setInterval(()=> {
    sensor_trigger();
}, 2000);


