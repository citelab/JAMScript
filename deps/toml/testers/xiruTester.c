
#include <stdio.h>
#include <stdlib.h>
#include "toml.h"
#include "tparser.h"
#include "files.h"

int main(){

	char *buf;
    int s;
	 if (read_file_to_buffer("t.tml", &buf, &s) == 0) {
        t_init_parse(buf);
        if (t_parse_doc() != T_VALID_VALUE) {
            printf("\n\n Parsing error... Exiting.\n");
            exit(1);
        }
        TOMLValue *t = t_get_value();
        TOMLValue *u;
}