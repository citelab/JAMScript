#include <stdio.h>

int main() {
    char *line = NULL;
    size_t len;
    
    while (getline(&line, &len, stdin) > 0)
	printf("Line %s\n", line);

}
