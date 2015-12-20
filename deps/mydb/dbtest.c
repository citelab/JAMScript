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

    // for testing purposes. we remove the old DB
    unlink("test.db");

    mydb_t *db = open_database("test.db", 16, 64);
    if (db == NULL) {
        printf("Unable to create db.. \n");
        exit(1);
    }

    // error count.
    int errcount = 0;


    // put some records...
    // create a key pointer array with maximum of 1000 elements
    void *keys[MAX_RECORDS];
    // Same with the data
    void *data[MAX_RECORDS];

    // generate keys and datas and stick them into the DB

    for (int i = 0; i < MAX_RECORDS; i++) {
        keys[i] = random_key(db);
        data[i] = random_data(db);
        database_put(db, keys[i], data[i]);
    }

    // Get them and validate that they are the same.
    void *tempdata = random_data(db);

    for (int i = 0; i < MAX_RECORDS; i++) {
        database_get(db, keys[i], tempdata);
        if (!check_equal_data(db, tempdata, data[i]))
            errcount++;
    }

#ifdef DETAILS
    printf("\nInsert-Retrieve Test: ");
    if (errcount == 0)
        printf("Passed\n");
    else
        printf("Failed\n");
#endif

    // Now check if we are able to retrieve something that is not there!
    void *tempkey;


    for (int i = 0; i < MAX_RECORDS; i++) {
        tempkey = random_key(db);
        if (database_get(db, tempkey, tempdata))
            errcount++;

        free(tempkey);
    }

#ifdef DETAILS
    printf("\nFake-Retrieve Test: ");
    if (errcount == 0)
        printf("Passed\n");
    else
        printf("Failed\n");
#endif

    // Test the iterator.. are we able to get the items..
    mydbiter_t *dbi = get_iterator(db);

    // Testing whether the iterator is able to get all the records..
    uint8_t flags[MAX_RECORDS];
    bzero(flags, MAX_RECORDS);
    int j;

    // allocate tempkey
    tempkey = random_key(db);
    // tempdate is already allocated
    while(get_next_record(dbi, tempkey, tempdata)) {
        // find the key in our array.. this gives the index
        j = -1;
        for (int i = 0; i < MAX_RECORDS; i++) {
            if (check_equal_key(db, tempkey, keys[i])) {
                j = i;
                break;
            }
        }
#ifdef DEBUG
        printf(" %d ", j);
#endif
        if (j < 0) {
            errcount++;
            continue;
        }
        if (flags[j] != 0) {
            errcount++;
            continue;
        }
    }

    destroy_iterator(dbi);

#ifdef DETAILS
    // The order does not matter.. however we should be able to
    // get them in some sequence..
    printf("\nIterator-Retrieve Test: ");
    if (errcount == 0)
        printf("Passed\n");
    else
        printf("Failed\n");
#endif

    // Now delete some records and see whether they actually
    // get deleted..

    // Delete about third of the records.. randomly select them for
    // deletion.

    int dcount = 0.3 * MAX_RECORDS;
    int dindx;
    for (int i = 0; i < MAX_RECORDS; i++)
        flags[i] = 1;

    while (dcount > 0) {
        // pick a key that is not yet deleted.
        while (1) {
            dindx = arc4random_uniform(MAX_RECORDS);
            if (flags[dindx] == 1) {
                flags[dindx] = 0;
                break;
            }
        }
#ifdef DEBUG
        printf("Dindx = %d ", dindx);
#endif

        // now delete the record
        if (!database_del(db, keys[dindx]))
        {
            printf("\nERROR! Unable to delete the record ..\n");
        }
        dcount--;
    }

    // Perform 10000 retrive operations.. we pick the
    // key randomly.. all deleted records should not be found.
    // Not deleted records should be found!

    for (int i = 0; i < 10000; i++) {
        // key index
        int kindx = arc4random_uniform(MAX_RECORDS);

        if (flags[kindx] == 1) {
            // Key is not deleted..
            if (database_get(db, keys[kindx], tempdata)) {
                if (!check_equal_data(db, data[kindx], tempdata))
                    errcount++;
            }
            else
                errcount++;
        }
        else
        {
            // Key is deleted..
            if (database_get(db, keys[kindx], tempdata))
                errcount++;
        }
    }
#ifdef DETAILS
    printf("\nDelete-Retrieve Test (using del/get): ");
    if (errcount == 0)
        printf("Passed\n");
    else
        printf("Failed\n");
#endif

    // Check deletion with the iterator..

    mydbiter_t *dit = get_iterator(db);

    // iterate through the records using the iterator.
    // randomly select a record for deletion.. using the previous delete
    // only delete upto an upper count.. say 25% of the MAX_RECORDS
    //
    while(get_next_record(dit, tempkey, tempdata)) {
        if (arc4random_uniform(40) < 10) {
            // find the indx of the key in the flags and set it as deleted.
            for (int i = 0; i < MAX_RECORDS; i++) {
                if (check_equal_key(db, tempkey, keys[i]) && flags[i]) {
                    flags[i] = 0;
                    del_prev_record(dit);
                    break;
                }
            }
        }
    }

    // Perform 10000 retrive operations.. we pick the
    // key randomly.. all deleted records should not be found.
    // Not deleted records should be found!

    for (int i = 0; i < 10000; i++) {
        // key index
        int kindx = arc4random_uniform(MAX_RECORDS);

        if (flags[kindx] == 1) {
            // Key is not deleted..
            if (database_get(db, keys[kindx], tempdata)) {
                if (!check_equal_data(db, data[kindx], tempdata))
                    errcount++;
            }
            else
                errcount++;
        }
        else
        {
            // Key is deleted..
            if (database_get(db, keys[kindx], tempdata))
                errcount++;
        }
    }
#ifdef DETAILS
    printf("\nIterator-Delete-Retrieve Test : ");
    if (errcount == 0)
        printf("Passed\n");
    else
        printf("Failed\n");
#endif


    // Retrieve the records and check for errors..
    destroy_iterator(dit);

    // Check whether the freelist mechanism is actually working.


    // Check the remaining records count


    // TODO: Insertions after deletions are not yet tested.. looks like it should work.
    // Lets check it later.. if necessary.
    // This DB needs a PATRICIA trie or something like that in the disk. The trie should
    // self balancing too..

    printf("ALL Tests: ");
    if (errcount == 0)
        printf("PASSED\n");
    else
        printf("\n!!ERRORS Found: %d\n", errcount);

    close_database(db);
}
