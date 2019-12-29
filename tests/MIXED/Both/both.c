int runatj(int x);

jasync runatc() {

	jsleep(5);
	runatj(10);
}


int main(int argc, char *argv[]) {

    runatc();
    return 0;
}
