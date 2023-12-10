int totalCalls = 0;

jtask* remoteCall()
{
    totalCalls++;
}

jtask* stateMonitor()
{
    while(1)
    {
	// TODO: should show delta time between prints!
	printf("Total Calls: %d\n", totalCalls);
	totalCalls = 0;
	fflush(stdout);
	jsleep(1000*1000);
    }
}


int main()
{
    stateMonitor();
    return 0;
}
