jasync doubler(int b, int c, jcallback complete) {
    var a = b*2;
    complete(a, "hey");
}

void onComplete(int result, char* q) {
	printf("%i\n", result);
}

int main() {
	doubler(3, onComplete);
    return 0;
}
