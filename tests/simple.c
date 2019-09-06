
jasync testloop()
{
    while(1) {
	jsleep(1000);
	printf("I just woke up\n");
    }
}
       

int main(int argc, char *argv[])
{
    testloop();
}
