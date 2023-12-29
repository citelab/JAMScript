
jtask* localfunc(int n, char *s) {
        
    while(1) {
        printf("Indx %d message - %s\n", n, s);
        jsleep(500000);
    }
}

jtask* {typeAonly} workerFuncX(char *s) {
    printf("WorkerFuncX -- %s\n", s);
}

jtask* {typeBonly} workerFuncY(char *s) {
    printf("WorkerFuncY -- %s\n", s);
}


int main(int argc, char *argv[])
{
    localfunc(10, "a-local-task");
    return 0;
}
