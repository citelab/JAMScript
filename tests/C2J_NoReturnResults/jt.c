jasync localme(int c, char* s) {
    while(1) {
        // jsys.sleep(2000000);
        jsys.dontyield();
        wprintf(L"############-->>> Hello  ME  %d... %s\n", c, s);
    }
}

jasync localyou(int c, char* s) {
    jarray int num[5] = {1, 2, 3, 4, 5};
    while(1) {
        jsys.sleep(1000000);
        wprintf(L"############-->>> Hello YOU  %d, %s\n", c, s);
        you(s, &num);
    }
}

int main(int argc, char* argv[]) {
    wprintf(L"folks we are printing with wide characters\n");
    localme(FLT_MANT_DIG, "cxxxxyyyy");
    localyou(hello(), "a-message-for-j: " BAZINGA);
    return 0;
}
