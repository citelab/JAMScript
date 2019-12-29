
// This is not called from J.. but it could be!
jasync loop() {

    while(1) {
	jsleep(500);
	printf("I am looping in the C side\n");
    }
}

int main() {
    loop();
}
