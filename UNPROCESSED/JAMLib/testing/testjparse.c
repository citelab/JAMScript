#include "jparser.h"
#include "json.h"
#include <stdio.h>
#include <stdlib.h>

int main() 
{
    char buf[2048];
    JSONValue *jval;
    JSONValue *qval;
    
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
	jval = get_value();
	print_value(jval);
	// should not overwrite jval.. otherwise we will lose the handle
	// needed to release the memory..
	printf("------------------\n");
	qval = query_value(jval, "sd", "args", 0);
	print_value(qval);
	printf("------------------\n");
    }

}
