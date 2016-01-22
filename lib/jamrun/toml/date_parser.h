void get_time(struct tm *tval, char * ret);
void print_time(struct tm *tval);
void subtract_time(struct tm *fval, struct tm *sval);
void add_time(struct tm *fval, struct tm *sval);
void make_time(struct tm *ts, int dston);
char *parse_datetime(char *buf, struct tm *ts, int dston);