
void callingj(int i);

jasync testfunc(char *s) {
    printf("Message: %s\n", s);
}



jasync loop() {
    int i;
    
    while(1) {
	jsleep(500);
	callingj(i++);
    }
}

int main() {
    loop();
}
