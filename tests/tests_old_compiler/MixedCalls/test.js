function X() {
    console.log("In function X");
    (function A() {
	console.log("In fucntion A");
	setTimeout(A, 2000);
    })();
}

X();
