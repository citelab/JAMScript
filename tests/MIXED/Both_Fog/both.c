void runatfog(char *s);

int count = 1;

jasync worker(int x) {

	jsleep(500);
	printf("Message at worker %d\n", x);
	runatfog("hello");
	count++;
}


int main(int argc, char *argv[]) {

    worker(1);
    return 0;
}
