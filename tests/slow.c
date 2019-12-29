
int count = 0;


jasync incr()
{
    if (count % 1000 == 0)
	printf("Value of count %d\n", count);

    count++;
}


jasync loop()
{
    while(1)
	incr();
}


int main()
{
    loop();
}
