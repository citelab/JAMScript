#include <stdbool.h>

// This is to make the free block search a little faster
#define FREE_LIST_SIZE                      16


// TODO: We need periodic compaction to make sure we are not consuming too many slots.
// As it is now, the slot count does not decrease at deletion. Only the record count decreases
// the slot count keeps growing with additions as new space in the file system is used. So the
// disk file also keeps growing monotonically..

typedef struct _mydbstate
{
    int keylen;
    int datalen;
    int numrecs;                            // Total number of records (decreases with deletion)
    int numslots;                           // Total number of slots (decreases only at compaction)
    int freelist[FREE_LIST_SIZE];
    int beginoffset;

} mydbstate_t;


typedef struct _mydb
{
    mydbstate_t state;
    int fdesc;

} mydb_t;


typedef struct _mydbiter
{
    mydb_t *db;
    int curindx;

} mydbiter_t;


/*
 * Function prototypes for the simple key value store. This is good for implementing
 * persistence at the C-core for certain configuration data.
 */

// Open an existing database with the given name.. returns NULL if such a database
// does not exist or is unable to open for some reason
mydb_t *open_database(char *filename);

// Close the given database
void close_database(mydb_t *db);

// Create a new database with the given filename, key length, and data length
mydb_t *create_database(char *filename, int keylen, int datalen);

// Put records into the key-value store. This is the synchronous method where the
// record is inserted (flushed) in the method to ensure durability
bool database_put_sync(mydb_t *mydb, void *key, void *data);

// Same as previous one without flushing. Less durable but more performant
bool database_put(mydb_t *mydb, void *key, void *data);

// Get the record. The data should be allocated with memory before calling this method.
bool database_get(mydb_t *mydb, void *key, void *data);

// Delete the record if it there. Returns true if the record could be deleted.
// Note that there is only one matching record
bool database_del(mydb_t *mydb, void *key);

// Get an iterator to the database
mydbiter_t *get_iterator(mydb_t *db);
void destroy_iterator(mydbiter_t *dbi);
bool get_next_record(mydbiter_t *dbi, char *key, void *data);
bool del_prev_record(mydbiter_t *dbi);
