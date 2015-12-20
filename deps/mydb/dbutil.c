#include "mydb.h"
#include <string.h>
#include <stdlib.h>
#include <stdio.h>


void print_key(mydb_t *db, char *label, void *key)
{
    char *str = (char *)key;
    printf("\n=========\nKey: %s\n", label);
    for (int i = 0; i < db->state.keylen; i++)
        printf("%c", str[i]);
    printf("\n");
}


void print_data(mydb_t *db, char *label, void *data)
{
    char *str = (char *)data;
    printf("\n=========\nData: %s\n", label);
    for (int i = 0; i < db->state.datalen; i++)
        printf("%c", str[i]);
    printf("\n");

}

void copy_key(mydb_t *db, void *key, char *newval)
{
    bzero(key, db->state.keylen);
    strcpy((char *)key, newval);
}

void copy_data(mydb_t *db, void *data, char *newval)
{
    bzero(data, db->state.datalen);
    strcpy((char *)data, newval);
}


// Return a string of length 'len'
// Obviously, the string should be deallocated by the receiver
char *random_string(int len)
{
    int i;
    static char *template = "abcdefghijklmnopqrstuvwxyz0123456789_";

    char *str = (char *)calloc(len + 1, sizeof(char));

    for (i = 0; i < len; i++)
        str[i] = template[arc4random_uniform(strlen(template))];
    str[i] = 0;

    return str;
}

void *random_key(mydb_t *db)
{
    return (void *)random_string(db->state.keylen);
}

void *random_data(mydb_t *db)
{
    return (void *)random_string(db->state.datalen);
}
