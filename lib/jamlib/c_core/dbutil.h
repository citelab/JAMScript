
void print_key(mydb_t *db, char *label, void *key);
void print_data(mydb_t *db, char *label, void *data);

void copy_key(mydb_t *db, void *key, char *newval);
void copy_data(mydb_t *db, void *data, char *newval);

char *random_string(int len);
void *random_key(mydb_t *db);
void *random_data(mydb_t *db);

void *create_key(mydb_t *db, const char *s);
void *create_data(mydb_t *db, const char *s);
