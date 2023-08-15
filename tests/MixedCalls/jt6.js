jcond {
    cloudonly: jsys.type == "cloud";
}

let counter = 1;

jtask {cloudonly} function getCloudId() {
    console.log("getCloudId... callled.. ", counter);
    resolve (counter++);
}

if (jsys.type === 'fog') {
//    setInterval(()=> {
//	console.log("Calling the cloud... ");
//	getCloudId().then((x)=> { console.log("Return value ", x.values()); }).catch(()=>{});
//	console.log("After calling.. ");
    //    }, 5000);
    console.log("I am fog.. ");
}
