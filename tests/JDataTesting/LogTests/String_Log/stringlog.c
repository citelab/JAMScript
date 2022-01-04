
jasync logdata() {

    char *names[10] = {"david", "mayer", "justin", "richard", "lekan", "ben", "owen", "nicholas", "karu", "clark"};
    int i;
    char buf[32];

    for (i = 0; i < 1000; i++) {
	sprintf(buf, "%d-%s", i, names[i % 10]);
	name = buf;
	printf("Wrote .. name: %s\n", buf);
	jsleep(1000);
    }
}


int main()
{
    logdata();
}
