let x = 10;
let y = 300.0;
let a, b;

setInterval(()=> {
		a = calc(x, y);
		b = number(x, y);
		Promise.all([a, b]).then((values) => {
				console.log("Value returned by calc and number ..", values);
		});
}, 1000);

