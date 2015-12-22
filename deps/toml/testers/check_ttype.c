
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "toml.h"
#include "tparser.h"
#include "files.h"


/**
 * This is a tester for the TOML C parser.
 *
 * call like the following:
 *      check_ttype toml_file expected_type list-of-attributes
 * If the list-of-attributes is NULL, we check the root object.
 */

int main(int argc, char *argv[])
{
    if (argc < 3) {
        fprintf(stderr, "Invalid Usage:: check_ttype toml_file expected_type optional-list-of-attributes\n");
        exit(EXIT_FAILURE);
    }

    char *type = argv[2];

    char *buf;
    int s;

    if (read_file_to_buffer(argv[1], &buf, &s) == 0) {
        t_init_parse(buf);
        if (t_parse_doc() != T_VALID_VALUE) {
            printf("\n\n Parsing error... Exiting.\n");
            exit(1);
        }
        TOMLValue *t = t_get_value();
        printf("File [%s] Type check: ", argv[1]);
        if (strcmp(type, t_typeof(t)) == 0)
            printf("PASSED\n");
        else
            printf("FAILED\n");
    }
}
