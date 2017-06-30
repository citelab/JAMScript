
void doubler(int, jcallback);

void onComplete(int result, char* q) {
	printf("%i\n", result);
}


int main() {
	doubler(3, onComplete);
    return 0;
}
