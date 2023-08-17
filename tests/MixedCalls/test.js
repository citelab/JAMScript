let counter = 1;

function afterDelay(n, x) {
    return new Promise((resolve, reject) => {
        setTimeout(()=> {resolve(x)}, n);
    });
}

afterDelay(1000, 1023).then((x)=> {console.log(x);});
afterDelay(500, 31023).then((x)=> {console.log(x);});
