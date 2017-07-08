
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>

#define BUFSIZE 1024



char *command_format_json(char *name, char *tag, char *cback, char *format, ...)
{
    va_list args;
    int i;
    char buf[BUFSIZE];
    char *json;
    char json_format[] = "{\"name\":\"%s\", \"tag\":\"%s\", \"args\":[%s], \"cback\":\"%s\"}\n";
    int ret;
    char* new_format;
    int count = 0; /* this counts additional overhead chars */

    if (format == NULL)
        return NULL;
    /*
     * Strings NEED to be properly quoted, return NULL if we
     * find an unquoted string.
     */
    for(i = 0; i < strlen(format); i++) {
        if (format[i] == '%' && format[i+1] == 's') {
            count += 2;
            if (format[i-1] != '"' || format[i+2] != '"') {
                return NULL;
            }
        }
    }

    /* Format is const so make a usable copy of it to play with */
    new_format = strdup(format);

    /* Replace spaces by commas. This will help for json formatting */
    for(i = 0; i < strlen(new_format); i++) {
        if (new_format[i] == ' ') {
            new_format[i] = ',';
            count++;
        }
    }

    va_start(args, format);
    ret = vsnprintf(buf, BUFSIZE, new_format, args);
    va_end(args);

    json = calloc((strlen(json_format) + strlen(name) + BUFSIZE), sizeof(char));
    ret = sprintf(json, json_format, name, tag, buf, cback);

    return json;
}

char *command_format_jsonk(char *name, char *tag, char *cback, char *format, va_list args)
{
    char buf[BUFSIZE];
    char *json;
    char *new_format;
    char json_format[] = "{\"name\":\"%s\", \"tag\":\"%s\", \"args\":[%s], \"cback\":\"%s\"}\n";
    int ret;

    if (format == NULL)
        return NULL;

    ret = vsnprintf(buf, BUFSIZE, format, args);

    json = calloc((strlen(json_format) + strlen(name) + BUFSIZE), sizeof(char));
    ret = sprintf(json, json_format, name, tag, buf, cback);

    return json;
}


char *call_jsonk(char *name, char *tag, char *cback, char *fmt, ...)
{
    va_list args;
    char fbuffer[BUFSIZE];
    char *bufptr = fbuffer;

    va_start(args, fmt);
    va_end(args);

    while(*fmt)
    {
        switch(*fmt++)
        {
            case 's':
                bufptr = strcat(bufptr, "\"%s\"");
                break;
            case 'i':
                bufptr = strcat(bufptr, "%d");
                break;
            case 'f':
            case 'd':
                bufptr = strcat(bufptr, "%f");
                break;
            default:
                break;
        }
        if (*fmt)
            bufptr = strcat(bufptr, ",");
    }


    char *s = command_format_jsonk(name, tag, cback, bufptr, args);
    return s;
}

int main()
{
    char *s = command_format_json("hello", "tag", "callback", "\"%s\" %d", "arg1", 1024);
    printf("String %s", s);

    s = call_jsonk("hello", "tag", "callback", "si", "arg1", 1024);
    printf("String %s", s);
}
