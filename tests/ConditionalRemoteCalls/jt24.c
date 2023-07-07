void remoteEchoReceiver(char *s, int count);


jtask void remoteEcho(char* s) {
    static int count = 0;
    
    remoteEchoReceiver(s, count++);
}

int main(int argc, char *argv[])
{
 //   localme(10, "cxxxxyyyy");
    return 0;
}
