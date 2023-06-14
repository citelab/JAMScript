#include<stdlib.h>
char*strdup(const char*i){//dword aligned strdup
    int n=0;
    for(;i[n];n++);
    char*o=(char*)calloc(sizeof(char),(n|7)+1);
    for(;n>=0;n--)
        o[n]=i[n];
    return o;
}
