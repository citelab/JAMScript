 
class T {

    constructor() {
	console.log("Hello...");
	this.q(45);
	this.ccc = 10;
	console.log("...... ", this);
    }

    q(i) {
	console.log("THis is another print", i);
    }
}

var t = new T();
console.log(t);
t.q(444);
