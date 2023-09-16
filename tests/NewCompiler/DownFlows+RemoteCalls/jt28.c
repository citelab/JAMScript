jasync call_remote_task(int c, char* s) {
    struct __zz tt;
    while(1) {
	jsys.sleep(1000000);
	printf("Calling remote task... \n");
	remote_task(c, s);
    }
}

jasync call_dflow_receiver(int c) {
    struct __zz tt;
    while(1) {
        qq.read(&tt);
        printf("Value read x: %d, yy: %f, u: %s\n", tt.x, tt.yy, tt.u.data);
    }
}

int x = 1;

int main(int argc, char* argv[]) {
    call_remote_task(x, "message-to-j");
    call_dflow_receiver(20);
    return 0;
}
