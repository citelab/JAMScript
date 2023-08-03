void remoteCall(int);
//#include <time.h>

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
