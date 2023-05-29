
a = [100];

let count = 1;
setInterval(()=> {
    a.push(count++);
}, 1000);

console.log("Printing a...");
a.forEach((x)=> {
    console.log("Elem ", x);
});