#include "../lib/jamlib/jamlib.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

jsync char * interpret(char* input) {
	var result = eval(input);
	console.log(result);
    return String(result); 
}


int main() {
	char *line = NULL;
	size_t size;
    while(1) {  
    	printf(">>> ");
		if (getline(&line, &size, stdin) <= 0) {
		    break;
		} else {
			if(strlen(line)==1) {
				break;
			} else {
				line[strlen(line)-1] = 0;
				printf("%s\n", interpret(line)); 
			}
		}
	}

	
	return 0;
}