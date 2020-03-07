
void callingj();


jasync loop() {
    int i;
    
    while(1) {
	printf("Calling jsleep.. \n");
	jsleep(500);
	callingj();
    }
}

int main() {
    loop();
}
