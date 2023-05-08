
process.on('message', function(x) {
    console.log("received message  ", x);
});

setInterval(()=> {
    console.log("hi..");
}, 100);
