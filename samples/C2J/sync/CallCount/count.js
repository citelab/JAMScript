var count = 0;

jsync function counter() {
	count++;
	console.log("Count is: " + count);
	return count;
}