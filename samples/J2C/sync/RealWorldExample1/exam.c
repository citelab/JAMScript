#include <stdio.h>
#include <string.h>

jsync int distributeExams() {
    printf("Start distributing the exams");
    char str[1000];
    while(1) {
        printf("Have you finished distributing the exams?\n");
        memset(str, 0, sizeof(str));
        fgets(str, 1000, stdin);
        if (strcmp(str, "yes\n") == 0) break;
    }
    return 0;
}

jsync int startExam() {
    printf("3 .. 2 .. 1..\n");
    printf("You can start the exams\n");
    return 0;
}


int main() {
    printf("In the main...\n");
}
