
#include <stdio.h>
#include <string.h>


int main(void)
{
    char *tokens[] = {0, 0, 0, 0, 0, 0, 0, 0};
//    char *input = "xxxxxx:yyyyy:zzzzz:00000:1111111:333333333";
    char *input = NULL;// "maheswaran";
    int i;

    char *p = strdup(input);

    for (i = 0; i < 8; i++) {
        tokens[i] = strsep(&p, ":");
        if (tokens[i] == NULL)
            break;
    }

    i = 0;
    while(tokens[i]) {
        printf("String[%d] = %s\n", i, tokens[i]);
        i++;
    }


}
