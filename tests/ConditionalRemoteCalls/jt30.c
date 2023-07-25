void remoteEchoReceiver(char *s, int count);
void processMessage(char *s);
void anotherProcessMsg(char *s);

jtask* localfuncA(int n, char *s) {
    
    while(1) {
        printf("FuncA --- Indx %d message - %s\n", n, s);
        processMessage("Hello there from worker");
        anotherProcessMsg("Hi there from worker");
        jsleep(500000);
    }
}

jtask* localfuncB(int n, char *s) {
    
    while(1) {
        printf("FuncB -- Indx %d message - %s\n", n, s);
        processMessage("Hello there from worker");
        anotherProcessMsg("Hi there from worker");
        jsleep(500000);
    }
}


int main(int argc, char *argv[])
{
    localfuncA(10, "a-local-task");
    localfuncB(20, "another-local-task");
    return 0;
}
