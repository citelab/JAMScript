
#include <stdio.h>
#include <stdlib.h>

#include "files.h"
#include "tparser.h"

void print_buffer(char *s, int q)
{
    for (int i = 0; i < q; i++)
        printf("%c, %d", s[i], s[i]);
}


int main(int argc, char *argv[])
{
    char *buf;
    int s;

    if (argc != 2) {
        printf("You need to pass the .tml file as argument\n");
        exit(1);
    }

    if (read_file_to_buffer(argv[1], &buf, &s) == 0) {
        printf("Number of chars read: %d\n", s);

    //    print_buffer(buf, s);
        t_init_parse(buf);
        printf("Parsing..");
        t_parse_doc();
        printf(" done\n");
        TOMLValue *t = t_get_value();
        t_print_value(t);


    } else
        printf("Quitting...\n");

}
