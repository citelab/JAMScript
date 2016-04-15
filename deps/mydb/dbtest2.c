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
    mydb_t *db = open_database("jamtest.db");
    if (db == NULL) {
        printf("Unable to open db.. \n");
        exit(1);
    }

    // get a record
    void *key = create_key(db, "hello");
    // Same with the data
    void *data = calloc(1, db->state.datalen+1);

    database_get(db, key, data);

    printf("Data retrieved: %s\n", (char *)data);
}
