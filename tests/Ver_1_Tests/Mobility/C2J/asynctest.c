
void calljside(int j);

jasync loop() {
    int i = 1;
    
    while(1) {
	jsleep(500);
	printf("Calling J... \n");
	calljside(i++);
    }
}



int main() {

    loop();
}
