jasync sendALotOfStuff()
{
    while(true)
    {
	remoteCall(2);
//	jsleep(1);
    }
}

int main(int argc, char *argv[])
{
    sendALotOfStuff();
    return 0;
}
