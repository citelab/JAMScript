#include "jparser.h"
#include <stdio.h>
#include <stdlib.h>

int main() 
{
    char buf[2048];
    
    FILE *fp = fopen("data.json", "r");

    if (fp == NULL) {
	printf("Unable to open data file \n");
	exit(1);
    }

    while (!feof(fp)) {
	fscanf(fp, "%s", buf);
	printf("Line - %s\n", buf);
	init_parse(buf);
	parse_value();
	print_value();
    }

}
