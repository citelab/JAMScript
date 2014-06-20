#include <stdlib.h>
#include <stdarg.h>
#include <stdio.h>

void testva(char *fmt, va_list args);

void firstva(char *fmt, ...)
{
    va_list args;

    va_start(args, fmt);
    testva(fmt, args);
    va_end(args);
}


void testva(char *fmt, va_list args)
{
    int x;
    char c, *s;

    while(*fmt) {
        switch(*fmt++) {
	case 's':
	    s = va_arg(args, char *);
	    printf("String %s\n", s);
	    break;
	case 'i':
	    x = va_arg(args, int);
	    printf("Int  %d\n", x);
	    break;
	case 'c':
	    c = va_arg(args, int);
	    printf("Char %d\n", c);
	    break;
        }
    }
}


int main()
{

    firstva("sic", "mahes", 3434, 'd');
    firstva("ssss", "mahes", "muthu", "maiuri", "mathy");

}
