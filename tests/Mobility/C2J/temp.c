
int getID();

jasync second() {

    while(1) {
	jsleep(500);
	printf("I am in the second task \n");
    }
}


jasync loop() {
    int i = 1;
    int id;
    
    while(1) {
	jsleep(500);
	id = getID();
	printf("I got the id %d\n", id);
    }
}



int main(int argc, char *argv[]) {

    loop();
    second();
    return 0;
}
