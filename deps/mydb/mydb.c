#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <assert.h>

#include <sys/types.h>
#include <sys/stat.h>
#include <sys/uio.h>
#include <unistd.h>
#include <fcntl.h>

#include "mydb.h"
#include "dbutil.h"


/*
 * An extremely simple key-value store in C. This implmementation has almost no
 * external dependency. It could be enhanced using a hash table, balanced tree, or
 * similar on-disk data structure. This is needed to avoid the problems faced
 * by the simple implementation.
 * This implementation should be used only for prototypes.
 */


/*
 * Helper functions...
 */

int get_free_record(mydb_t *db)
{
    int recnum = -1;

    for (int i = 0; i < FREE_LIST_SIZE; i++) {
        if (db->state.freelist[i] > -1) {
            recnum = db->state.freelist[i];
            db->state.freelist[i] = -1;
            break;
        }
    }

    if (recnum >= 0) {
        int nmeta = mywrite(db->fdesc, &(db->state), sizeof(mydbstate_t), 0);
        assert(nmeta == sizeof(mydbstate_t));

        return recnum;
    }
    else
    {
        if (rebuild_free_list(db)) {
            // we should succeed now..
            return get_free_record(db);
        }
        else
        {
            printf("ERROR! Unable to rebuild the free list.. \n");
            exit(1);
        }
    }
}


bool rebuild_free_list(mydb_t *db)
{
    struct stat stat;
    int nkey, j = 0;
    void *keybuf;

    // get stat and assert there is no funky errors..
    assert(fstat(db->fdesc, &stat) == 0);
    keybuf = malloc(db->state.keylen);

    assert(db->state.numslots == (stat.st_size - db->state.beginoffset)/(db->state.keylen + db->state.datalen));
    assert(db->state.numslots >= db->state.numrecs);
    if (db->state.numrecs <= db->state.numslots - FREE_LIST_SIZE/2) {
        for (int i = 0; i < db->state.numslots; i++) {
            nkey = myread(db->fdesc, keybuf, db->state.keylen, db->state.beginoffset +
                                        i * (db->state.keylen + db->state.datalen));
            if (check_zero_key(db, keybuf)) {
                db->state.freelist[j++] = i;
                if (j >= FREE_LIST_SIZE)
                    break;
            }
        }
    }
    else
        add_free_records(db, &(db->state.numslots));

    mywrite(db->fdesc, &(db->state), sizeof(mydbstate_t), 0);
    free(keybuf);
    return true;
}


void add_free_records(mydb_t *db, int *from)
{
    int j = *from;
    for(int i = 0; i < FREE_LIST_SIZE; i++)
        if (db->state.freelist[i] == -1)
            db->state.freelist[i] = j++;
    *from = j;
}

void add_to_freelist(mydb_t *db, int rec)
{
    for (int i = 0; i < FREE_LIST_SIZE; i++)
        if (db->state.freelist[i] == -1) {
            db->state.freelist[i] = rec;
            return;
        }
}


// Limited to checking within 64 bytes for an all zero memory region
bool check_zero_key(mydb_t *db, void *key)
{
    static const char zerov[64];        // static is initialized to all zeros

    return !memcmp(zerov, key, db->state.keylen);
}


bool check_equal_key(mydb_t *db, void *ckey, void *rkey)
{
#ifdef DEBUG
    print_key(db, "CKey", ckey);
    print_key(db, "RKey", rkey);
#endif

    return !memcmp(ckey, rkey, db->state.keylen);
}


bool check_equal_data(mydb_t *db, void *cdata, void *rdata)
{
#ifdef DEBUG
    print_data(db, "CData", cdata);
    print_data(db, "RDdata", rdata);
#endif

    return !memcmp(cdata, rdata, db->state.datalen);
}

// Return the database and return the record number if found
// Otherwise, return -1.
int search_database(mydb_t *db, void *rkey)
{
    void *ckey = malloc(db->state.keylen);

    // This is the most inefficient aspect of this simple key-value store.
    // We are doing an linear search.. ahh!
    for (int i = 0; i < db->state.numslots; i++) {
        int nkey = myread(db->fdesc, ckey, db->state.keylen, db->state.beginoffset + i * (db->state.keylen + db->state.datalen));
        if (nkey == db->state.keylen && check_equal_key(db, ckey, rkey)) {
            free(ckey);
            return i;
        }
    }
    // not found..
    free(ckey);
    return -1;
}

// Returns the number of bytes written or -1 if error
int mywrite(int fd, void *data, int datalen, int offset)
{
    lseek(fd, offset, SEEK_SET);
    return write(fd, data, datalen);
}


// Returns the number of bytes actually read or -1 if error
int myread(int fd, void *data, int datalen, int offset)
{
    lseek(fd, offset, SEEK_SET);
    return read(fd, data, datalen);
}



// If the key matches and already existing record, we overwrite the
// previous record...
//
bool database_put(mydb_t *mydb, void *key, void *data)
{
    // check the key.. does it exist?
    int recnum = search_database(mydb, key);
    if (recnum < 0) {
#ifdef DEBUG
        printf("Adding new ...");
#endif
        // Get a new record number..
        recnum = get_free_record(mydb);

        // write the key..
        int nkey = mywrite(mydb->fdesc, key, mydb->state.keylen, mydb->state.beginoffset + recnum * (mydb->state.keylen + mydb->state.datalen));
        // write the data..
        int ndata = mywrite(mydb->fdesc, data, mydb->state.datalen,
                mydb->state.keylen + mydb->state.beginoffset + recnum * (mydb->state.keylen + mydb->state.datalen));

        mydb->state.numrecs++;
        mywrite(mydb->fdesc, &(mydb->state), sizeof(mydbstate_t), 0);

        if (nkey == mydb->state.keylen &&
            ndata == mydb->state.datalen)
            return true;
        else
            return false;
    }
    else
    {
#ifdef DEBUG
        printf("Revising old  %d\n", recnum);
#endif

        int ndata = mywrite(mydb->fdesc, data, mydb->state.datalen,
                mydb->state.keylen + mydb->state.beginoffset + recnum * (mydb->state.keylen + mydb->state.datalen));

        if (ndata == mydb->state.datalen)
            return true;
        else
            return false;
    }
}


// Given the key, we find the data object.
// The key should match, otherwise nothing is pulled out.
// In that case, the function returns false.
bool database_get(mydb_t *mydb, void *key, void *data)
{
    // search through the database to get the record number.. this is
    // why we need a hash table!

    int recnum = search_database(mydb, key);
#ifdef DEBUG
    printf("[key: %d] ", recnum);
    print_key(mydb, "Get ", key);
    printf("\n");
#endif

    if (recnum < 0)
        return false;           // key not found

    int ndata = myread(mydb->fdesc, data, mydb->state.datalen,
            mydb->state.keylen + mydb->state.beginoffset + recnum * (mydb->state.keylen + mydb->state.datalen));

    if (ndata == mydb->state.datalen)
        return true;
    else
        return false;
}

// Delete an existing record with the given key.. if no record is found with
// matching key, return false.
bool database_del(mydb_t *mydb, void *key)
{
    // search through the database to get the record number.. this is
    // why we need a hash table!
    int recnum = search_database(mydb, key);
#ifdef DEBUG
    printf("[key: %d] ", recnum);
    print_key(mydb, "Del ", key);
    printf("\n");
#endif

    if (recnum < 0)
        return false;           // key not found.. delete failed.

    // blank the key
    void *blank = malloc(mydb->state.keylen);
    bzero(blank, mydb->state.keylen);

    int nkey = mywrite(mydb->fdesc, blank, mydb->state.keylen,
                        mydb->state.beginoffset + recnum * (mydb->state.keylen + mydb->state.datalen));

    // free the key
    free(blank);

    // decrement the record count and insert record into free list
    mydb->state.numrecs--;
    add_to_freelist(mydb, recnum);

    // update meta data
    int nmeta = mywrite(mydb->fdesc, &(mydb->state), sizeof(mydbstate_t), 0);

    if (nkey == mydb->state.keylen && nmeta == sizeof(mydbstate_t))
        return true;
    else
        return false;
}


mydb_t *open_database(char *filename, int keylen, int datalen)
{
    int nmeta, fd;

    mydb_t *db = (mydb_t *)calloc(1, sizeof(mydb_t));

    // Check for file existence...
    if ((fd = open(filename, O_RDWR)) < 0)  {
        // File does not exist.. we are creating a new database
        fd = open(filename, O_CREAT|O_RDWR);
        assert(fd > 0);                                     // we fail if we are unable to get a valid FD
        db->fdesc = fd;
        db->state.keylen = keylen;
        db->state.datalen = datalen;
        db->state.numrecs = 0;
        db->state.numslots = FREE_LIST_SIZE;                // Even without a single insertion.. the file is allocated numslots..
        for(int i = 0; i < FREE_LIST_SIZE; i++)
            db->state.freelist[i] = i;
        db->state.beginoffset = sizeof(mydbstate_t);
        nmeta = mywrite(db->fdesc, &(db->state), sizeof(mydbstate_t), 0);
    } else {
        // We are using an existing database that is already open!
        db->fdesc = fd;
        // keylen and datalen are checked against the available meta data and a warning is
        // flagged if there is a discrepancy..
        nmeta = myread(db->fdesc, &(db->state), sizeof(mydbstate_t), 0);
        if (!(db->state.keylen == keylen && db->state.datalen == datalen)) {
            printf("ERROR! key and data lengths are specified inconsistent values\n");
            printf("ERROR! database store is corrupted??\n\n");

            return NULL;
        }
    }
    return db;
}


void close_database(mydb_t *db)
{
    int nmeta;
    // flush the state to the disk
    nmeta = mywrite(db->fdesc, &(db->state), sizeof(mydbstate_t), 0);
    assert(nmeta == sizeof(mydbstate_t));

    // close the file
    close(db->fdesc);

    // free the data structure..
    free(db);
}


// Get an iterator for the database. It is pretty simple.. just a running index.
// Because the running index is in the iterator.. we can have multiple iterators for a single open database
mydbiter_t *get_iterator(mydb_t *db)
{
    mydbiter_t *dbi = (mydbiter_t *)calloc(1, sizeof(mydbiter_t));

    dbi->db = db;
    dbi->curindx = 0;

    return dbi;
}


void destroy_iterator(mydbiter_t *dbi)
{
    free(dbi);
}


// Returns true.. if there is a record and it was read properly.
bool get_next_record(mydbiter_t *dbi, char *key, void *data)
{
    mydb_t *db = dbi->db;

    // from the current "cursor" position keep reading until we get a valid record.
    // so we are trying to read a valid record. only thing is that we cannot read part the numslots

    while (dbi->curindx < db->state.numslots) {

        int nkey = myread(db->fdesc, key, db->state.keylen, db->state.beginoffset + dbi->curindx * (db->state.keylen + db->state.datalen));
        if (nkey <= 0)
            return false;

        if ((nkey == db->state.keylen) && (check_zero_key(db, key)))
            dbi->curindx++;
        else {
            int ndata = myread(db->fdesc, data, db->state.datalen,
                    db->state.keylen + db->state.beginoffset + dbi->curindx * (db->state.keylen + db->state.datalen));
            if (ndata == db->state.datalen) {
                dbi->curindx++;
                return true;
            }
            if (ndata <= 0)
                return false;
        }
    }

    // we are at the end of the database
    return false;
}


// We need to remove the record before the current one.
// This would fail if we are at record 0. However, if we have called
// get_next_record at 0, the cursor is at 1 (which could be EOF for a DB with 1 record)
//
bool del_prev_record(mydbiter_t *dbi)
{
    mydb_t *db = dbi->db;
    void *key = random_key(db);               // random key allocation to make room..

    if (dbi->curindx == 0)
        return false;

    // There is no need to adjust the curindx in the iterator
    // We are doing an in-place deletion, where the records are left as it is.
    // We are just making the key field all 0s. Just blanking it.

    int nkey = myread(db->fdesc, key, db->state.keylen, db->state.beginoffset + (dbi->curindx -1) * (db->state.keylen + db->state.datalen));
    if (nkey <= 0) {
        free(key);
        return false;
    }

    // blank the key
    void *blank = malloc(db->state.keylen);
    bzero(blank, db->state.keylen);

    nkey = mywrite(db->fdesc, blank, db->state.keylen,
                            db->state.beginoffset + (dbi->curindx -1) * (db->state.keylen + db->state.datalen));

    // free the key
    free(blank);

    // decrement the record count and insert record into free list
    db->state.numrecs--;
    add_to_freelist(db, (dbi->curindx -1));

    // update meta data
    int nmeta = mywrite(db->fdesc, &(db->state), sizeof(mydbstate_t), 0);

    free(key);
    if (nkey == db->state.keylen && nmeta == sizeof(mydbstate_t))
        return true;
    else
        return false;
}
