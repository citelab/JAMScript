#include "mydb.h"
#include "dbutil.h"

#include <strings.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <stdbool.h>

#define MAX_RECORDS                         1000

int main(void)
{
    // This test program is creating a database and writing stuff to it

    mydb_t *db = create_database("jamtest.db", 16, 64);
    if (db == NULL) {
        printf("Unable to create db.. \n");
        exit(1);
    }
    // put some records...
    void *key;
    // Same with the data
    void *data;

    key = create_key(db, "hello");
    data = create_key(db, "how are you doing?");

    database_put_sync(db, key, data);

}
