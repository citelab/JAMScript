jamdef void test(int b) {
	int onload() {
		int a = 1;
		return a;
	};
	int oncomplete() {
		var b = 2;
		return b;
	};
}