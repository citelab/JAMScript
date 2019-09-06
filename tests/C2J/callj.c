
void callingj(int i);


jasync loop() {
    int i;
    
    while(1) {
	printf("Calling jsleep.. \n");
	jsleep(500);
	callingj(i++);
    }
}

int main() {
    loop();
}
