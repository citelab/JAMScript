void remoteCall(int);

jtask* sendALotOfStuff()
{
    while(true)
    {
	remoteCall(2);
//	jsleep(1);
    }
}

int main()
{
    sendALotOfStuff();
}
