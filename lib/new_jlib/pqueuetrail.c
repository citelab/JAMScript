#include "pqueue.h"
#include <string.h>
#include <stdio.h>

char names[10][4] = {
  "albert", "kevin", "beta", "epsilon"
};

int cmpstr(const void *s1, const void *s2) {
    return strcmp(s1, s2);
}

int main() {
    PQueue pq;
    pqueue_init(&pq, cmpstr, NULL);
    for (int i = 0; i < 4; i++) {
        pqueue_insert(&pq, names[i]);
    }
    for (int i = 0; i < 4; i++) {
        char *cstr;
        pqueue_extract(&pq, &cstr);
        printf("%d. %s\n", i, cstr);
    }
    printf("cmpstr(\"albert\", \"kevin\")=%d\n", strcmp("albert", "kevin"));
    return 0;
}