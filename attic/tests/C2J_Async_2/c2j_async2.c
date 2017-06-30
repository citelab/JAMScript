

void doubler(int, jcallback);

void onComplete(char* q) {
	printf("%s\n", q);
}


int main() {
	doubler(3, onComplete);
    return 0;
}
