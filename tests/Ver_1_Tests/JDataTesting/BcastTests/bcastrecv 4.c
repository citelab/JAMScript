
jasync loop() {
    char *p;
    
    while(1) {
	p = pstr;
	printf("Received string: %s\n", p);
    }
}


int main() {

    loop();    
}
