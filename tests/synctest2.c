
int getId();


jasync testloop() {
    int x;
    while(1) {
	jsleep(5000);
	x = getId();
	printf("ID %d \n", x);
    }
}

int main() {
    testloop();
}
