void remoteEchoReceiver(char *s, int count);


jtask* remoteEcho(char* s) {
    static int count = 0;
    
    remoteEchoReceiver(s, count++);
    printf("Remote Ech called... %s\n", s);
}

int main(int argc, char *argv[])
{
 //   localme(10, "cxxxxyyyy");
    return 0;
}
