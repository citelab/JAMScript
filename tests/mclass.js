
class MyClass {

    constructor(str, j) {

	if (MyClass.this)
	    return MyClass.this;
	MyClass.this = this;

	this.date = new Date();
	this.name = str;
	
	return this;
    }

    print() {
	console.log("Printing from MyCLass", this.date, this.name);
    }
}

module.exports = MyClass;

