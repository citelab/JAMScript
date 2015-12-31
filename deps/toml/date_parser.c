#include <stdio.h>
#include <time.h>
#include <string.h>
#include <stdlib.h>


/* Fills ret with the proper time
 *
 */
void get_time(struct tm *tval, char * ret){
     int index = strftime(ret, 128, "%C%y-%m-%eT%TZ GMT %z", tval);
     ret[index] = '\0';
}

/**
 * Print time to standard out..
 */

void print_time(struct tm *tval)
{
    char buf[128];

    strftime(buf, 128, "%C%y-%m-%eT%TZ GMT %z", tval);
    printf("%s\n", buf);
}


/**
 * We actually add time here. I know it is kind of confusing!
 */

void subtract_time(struct tm *fval, struct tm *sval)
{
    fval->tm_sec += sval->tm_sec;
    fval->tm_min += sval->tm_min;
    fval->tm_hour += sval->tm_hour;
    mktime(fval);
}


/**
 * We are subtracting time here.
 */

void add_time(struct tm *fval, struct tm *sval)
{
    fval->tm_sec -= sval->tm_sec;
    fval->tm_min -= sval->tm_min;
    fval->tm_hour -= sval->tm_hour;
    mktime(fval);
}


/**
 * Make time does the following: it sets the Daylight savings time. Adjusts the
 * time zone.
 */

void make_time(struct tm *ts, int dston)
{
    char buf[128];
    struct tm q;
    memset(&q, 0, sizeof(struct tm));

    ts->tm_isdst = dston;
    mktime(ts);

    /**
     * Get to know the timezone offset.. shift the specified time which is in GMT
     * to the local zone..
     */
    strftime(buf, 128, "%z", ts);
    if (strptime(buf, "-%H%M", &q) != NULL)
        add_time(ts, &q);
    else if (strptime(buf, "+%H%M", &q) != NULL)
        subtract_time(ts, &q);
}



/**
 * Parse the string in buf into a time struct. If parse is successful we return a pointer to the
 * next location in the input buffer (buf) that was passed into the parse_datatime() function.
 * If the parse is unsuccessful, we receive a NULL pointer. The dston flag will indicate whether the
 * Daylight savings time should be adhered to or not.
 */

char *parse_datetime(char *buf, struct tm *ts, int dston)
{
    char *rval;
    char *nrval;
    struct tm lts;

    int i, j;
    //int off = 0;

    char test[128];
    memset(&lts, 0, sizeof(struct tm));

    if ((rval = strptime(buf, "%C%y-%m-%eT%TZ", ts)) != NULL) {
        // matching format like 1979-05-27T07:32:00Z
        make_time(ts, dston);
        return rval;
    } 
    else if ((rval = strptime(buf, "%C%y-%m-%eT%T", ts)) != NULL) {
        // matching format like 1979-05-27T00:32:00-07:00
        make_time(ts, dston);
        
        //The section below is used to prevent a weird segfault I get...
        
        for(i = 9; i < 128; i++){
            if(buf[i] == '+' || buf[i] == '-')
                break;
        }
        j = i;
        for(i = j; i < 128; i++){
            test[i-j] = buf[i];
        }
        //At least it works 
        
        if ((nrval = strptime(test, "-%R", &lts)) != NULL) {
            // parsing negative offset
            subtract_time(ts, &lts);
            return nrval;
        }
        
        if ((nrval = strptime(test, "+%R", &lts)) != NULL) {
            // parsing positive offet
            add_time(ts, &lts);
            return nrval;
        }
        
        // no offset
        
        return rval;
    
    } else if ((rval = strptime(buf, "%C%y-%m-%e", ts)) != NULL) {
        // parsing format like 1979-05-27
        make_time(ts, dston);
        return rval;
    } else
        return NULL;
}

/*
int main(int ac, char *av[])
{
    char buf[128];
    struct tm q;

    if (parse_datetime(av[1], &q, 1) != NULL) {

        strftime(buf, 128, "%C%y-%m-%eT%TZ GMT %z", &q);
        printf("String: %s\n", buf);
    } else {
        printf("Parse failed..\n");
    }

}
*/