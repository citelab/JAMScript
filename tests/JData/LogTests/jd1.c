int i;

jasync loop() {

    while(1) {
	x = i;
	i++;
	printf("Writing value into the stream..\n");
	jsleep(1000);
    }
}

int main() {
    loop();
}

