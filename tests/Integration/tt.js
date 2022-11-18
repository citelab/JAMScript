let count = 0;
function you(str) {
    count++;
    if ((count % 1000) === 0) {
        console.log(count);
    }
}

setInterval(()=> {
	you("hello");
}, 1);
