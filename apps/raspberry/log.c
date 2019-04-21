jasync logdata() {

    char *logs[3] = {"logA", "logB", "logC"};
    int i;
    char buffer[32];

    for (i = 0; i < 1000; i++) {
        sprintf(buffer, "%d-%s", i, logs[i % 3]);
        log_buffer = buffer;
        printf("Wrote .. log: %s\n", buffer);
        jsleep(1000);
    }
}

int main()
{
    logdata();
}
