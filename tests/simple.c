void helloj();


jasync testloop()
{
    while(1) {
	jsleep(1000);
	printf("I just woke up\n");
	helloj();
    }
}
       

int main(int argc, char *argv[])
{
    testloop();
}
