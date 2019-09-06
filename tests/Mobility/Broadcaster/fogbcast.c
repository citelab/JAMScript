jasync loop() {
    char *x;
    int i = 1;
    
    while(1) {
	x = y;
	printf("i = %d, X = %s\n", i++, x);
    }
}


int main() {

    printf("Started the C program \n");
    loop();
}
