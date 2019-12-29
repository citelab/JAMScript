
const MClass = require('./mclass');

class NewClass {

    constructor(str) {

	if (NewClass.this)
	    return NewClass.this;
	NewClass.this = this;

	this.nc = new MClass("hello2", 10);
	
	return this;
    }

    print() {
	this.nc.print();
    }
}

module.exports = NewClass;

