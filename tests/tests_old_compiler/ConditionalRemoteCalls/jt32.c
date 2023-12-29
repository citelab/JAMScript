void remoteEchoReceiver(char *s, int count);
int processMessage(char *s);
int anotherProcessMsg(char *s);

jtask* localfuncA(int n, char *s) {
    int x, y;
    
    while(1) {
        printf("FuncA --- Indx %d message - %s\n", n, s);
        x = processMessage("Hello there from worker");
        y = anotherProcessMsg("Hi there from worker");
        printf("x = %d, y = %d\n", x, y);
        jsleep(500000);
    }
}

jtask* localfuncB(int n, char *s) {
    int x, y;

    while(1) {
        printf("FuncB -- Indx %d message - %s\n", n, s);
        x = processMessage("Hello there from worker");
        y = anotherProcessMsg("Hi there from worker");
        printf("x = %d, y = %d\n", x, y);
        jsleep(500000);
    }
}


int main(int argc, char *argv[])
{
    localfuncA(10, "a-local-task");
    localfuncB(20, "another-local-task");
    return 0;
}
